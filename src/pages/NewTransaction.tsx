import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { TransactionType } from '../domain/transaction'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

/** Which way the chosen wallet moves: out of it, into it, or untouched. */
type WalletDir = 'none' | 'out' | 'in'

const TRANSACTION_TYPES: { value: TransactionType; defaultDir: WalletDir }[] = [
  { value: 'easyload', defaultDir: 'out' },
  { value: 'send', defaultDir: 'out' },
  { value: 'receive', defaultDir: 'in' },
  { value: 'package', defaultDir: 'out' },
  { value: 'other', defaultDir: 'none' },
]

export default function NewTransaction() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addTransaction = useAppStore((s) => s.addTransaction)

  const [type, setType] = useState<TransactionType>('easyload')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [dir, setDir] = useState<WalletDir>('out')
  const [amount, setAmount] = useState<number>(0)
  const [commission, setCommission] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  const [notesIn, setNotesIn] = useState<Record<number, number>>({})
  const [notesOut, setNotesOut] = useState<Record<number, number>>({})
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!data) return <div className="p-8">Loading…</div>

  const denominations = data.settings.denominations

  const amountPaisa = toPaisa(amount)
  const commissionPaisa = toPaisa(commission)
  const discountPaisa = toPaisa(discount)

  // walletDelta is a SIGNED delta added to the wallet balance: money leaving the
  // float (out) must be negative, money arriving (in) positive. Only applies when
  // a wallet is selected and the direction is not 'none'.
  const useWallet = dir !== 'none' && !!walletId
  const walletDelta = useWallet ? (dir === 'out' ? -amountPaisa : amountPaisa) : 0
  const cashDelta = totalCash(notesIn) - totalCash(notesOut)
  const wallet = data.wallets.find((w) => w.id === walletId)

  const isValid = amountPaisa > 0

  function pickType(t: TransactionType) {
    setType(t)
    setDir(TRANSACTION_TYPES.find((x) => x.value === t)!.defaultDir)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return

    setLoading(true)
    setError(null)
    try {
      await addTransaction({
        type,
        walletId: useWallet ? walletId : null,
        walletDelta,
        amount: amountPaisa,
        commission: commissionPaisa,
        discount: discountPaisa,
        notesIn,
        notesOut,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        note: note || undefined,
      })
      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? 'Change given exceeds the cash in the drawer. Adjust the notes and try again.'
          : 'Could not save the transaction. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">New Transaction</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type */}
        <div className="rounded-xl border bg-white p-3">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Transaction Type</label>
          <div className="flex flex-wrap gap-2">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => pickType(t.value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  type === t.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.value.charAt(0).toUpperCase() + t.value.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet Selection */}
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <label htmlFor="wallet" className="block text-sm font-semibold text-slate-600">
            Wallet
          </label>
          <select
            id="wallet"
            value={walletId || ''}
            onChange={(e) => setWalletId(e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">No Wallet</option>
            {data.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({formatPKR(w.balance)})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['out', 'in', 'none'] as WalletDir[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-label={
                  d === 'out' ? 'wallet money out' : d === 'in' ? 'wallet money in' : 'wallet no change'
                }
                onClick={() => setDir(d)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                  dir === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {d === 'out' ? 'Money OUT' : d === 'in' ? 'Money IN' : 'No change'}
              </button>
            ))}
          </div>
        </div>

        {/* Amount & Commission */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-slate-600">
              Amount (Rs)
            </label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border px-2 py-1 text-right"
              min="0"
              step="0.01"
            />
          </div>

          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="commission" className="mb-2 block text-sm font-semibold text-slate-600">
              Commission (Rs)
            </label>
            <input
              id="commission"
              type="number"
              value={commission}
              onChange={(e) => setCommission(Number(e.target.value))}
              className="w-full rounded-lg border px-2 py-1 text-right"
              min="0"
              step="0.01"
            />
          </div>

          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="discount" className="mb-2 block text-sm font-semibold text-slate-600">
              Discount (Rs)
            </label>
            <input
              id="discount"
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full rounded-lg border px-2 py-1 text-right"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Notes Received */}
        <NotePicker
          label="Notes Received"
          denominations={denominations}
          counts={notesIn}
          onChange={setNotesIn}
        />

        {/* Change Given */}
        <NotePicker
          label="Change Given"
          denominations={denominations}
          counts={notesOut}
          onChange={setNotesOut}
        />

        {/* Customer Details */}
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="customerName" className="mb-2 block text-sm font-semibold text-slate-600">
            Customer Name (optional)
          </label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Ali, Shop Name"
          />
        </div>

        <div className="rounded-xl border bg-white p-3">
          <label
            htmlFor="customerPhone"
            className="mb-2 block text-sm font-semibold text-slate-600"
          >
            Phone (optional)
          </label>
          <input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., 03001234567"
          />
        </div>

        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-600">
            Note (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Rush order, Special request"
            rows={3}
          />
        </div>

        {/* Live preview of the effect this transaction will have */}
        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          {useWallet && wallet && (
            <div>
              {wallet.name}: {formatPKR(wallet.balance)} → {formatPKR(wallet.balance + walletDelta)}
            </div>
          )}
          <div>
            Cash effect: {cashDelta >= 0 ? '+' : ''}
            {formatPKR(cashDelta)}
          </div>
          <div>Profit: {formatPKR(commissionPaisa - discountPaisa)}</div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* Submit & Cancel */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl bg-slate-200 py-3 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`rounded-xl py-3 font-semibold text-white ${
              isValid && !loading ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}
