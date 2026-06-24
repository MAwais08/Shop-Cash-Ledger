import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { TransactionType, CommissionMode } from '../domain/transaction'
import { deriveMovements } from '../domain/transaction'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'easyload', label: 'Easyload' },
  { value: 'package', label: 'Package' },
  { value: 'other', label: 'Other' },
]

/** Which way the chosen wallet moves for 'other': out of it, into it, or untouched. */
type WalletDir = 'none' | 'out' | 'in'

function signed(p: number): string {
  return `${p >= 0 ? '+' : ''}${formatPKR(p)}`
}

export default function NewTransaction() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addTransaction = useAppStore((s) => s.addTransaction)

  const [type, setType] = useState<TransactionType>('deposit')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [amount, setAmount] = useState<number>(0)
  const [commission, setCommission] = useState<number>(0)
  const [commissionMode, setCommissionMode] = useState<CommissionMode>('cash')
  const [dir, setDir] = useState<WalletDir>('none') // only used by 'other'
  const [notesIn, setNotesIn] = useState<Record<number, number>>({})
  const [notesOut, setNotesOut] = useState<Record<number, number>>({})
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountPaisa = toPaisa(amount)
  const commissionPaisa = toPaisa(commission)

  const actualNet = useMemo(() => totalCash(notesIn) - totalCash(notesOut), [notesIn, notesOut])

  const derived = useMemo(
    () => deriveMovements(type, amountPaisa, commissionPaisa, commissionMode),
    [type, amountPaisa, commissionPaisa, commissionMode],
  )

  if (!data) return <div className="p-8">Loading…</div>

  const isGuided = type !== 'other'
  const showCommission = type === 'deposit' || type === 'withdraw'

  // For 'other': manual signed wallet delta from the direction toggle.
  const otherWalletDelta = dir === 'out' ? -amountPaisa : dir === 'in' ? amountPaisa : 0
  const useOtherWallet = dir !== 'none' && !!walletId

  const wallet = data.wallets.find((w) => w.id === walletId)
  const matches = actualNet === derived.cashDelta
  const isValid = isGuided
    ? amountPaisa > 0 && matches
    : amountPaisa > 0

  const denominations = data.settings.denominations

  function pickType(t: TransactionType) {
    setType(t)
    if (t === 'easyload' || t === 'package') setCommission(0)
    if (t === 'other') setDir('out')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      if (isGuided) {
        await addTransaction({
          type,
          walletId,
          amount: amountPaisa,
          commission: commissionPaisa,
          commissionMode,
          notesIn,
          notesOut,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          note: note || undefined,
        })
      } else {
        await addTransaction({
          type: 'other',
          walletId: useOtherWallet ? walletId : null,
          walletDelta: otherWalletDelta,
          amount: amountPaisa,
          commission: 0,
          commissionMode: 'cash',
          notesIn,
          notesOut,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          note: note || undefined,
        })
      }
      navigate('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'CASH_MISMATCH'
          ? `Notes don't match the transaction — off by ${formatPKR(Math.abs(derived.cashDelta - actualNet))}.`
          : msg === 'NEGATIVE_NOTES'
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
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => pickType(t.value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  type === t.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet */}
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <label htmlFor="wallet" className="block text-sm font-semibold text-slate-600">Wallet</label>
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

          {/* Manual direction — only for 'other' */}
          {type === 'other' && (
            <div className="flex gap-2">
              {(['out', 'in', 'none'] as WalletDir[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={d === 'out' ? 'wallet money out' : d === 'in' ? 'wallet money in' : 'wallet no change'}
                  onClick={() => setDir(d)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    dir === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {d === 'out' ? 'Money OUT' : d === 'in' ? 'Money IN' : 'No change'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount + Commission */}
        <div className={`grid gap-2 ${showCommission ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-slate-600">Amount (Rs)</label>
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
          {showCommission && (
            <div className="rounded-xl border bg-white p-3">
              <label htmlFor="commission" className="mb-2 block text-sm font-semibold text-slate-600">Commission (Rs)</label>
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
          )}
        </div>

        {/* Commission mode toggle */}
        {showCommission && (
          <div className="rounded-xl border bg-white p-3">
            <label className="mb-2 block text-sm font-semibold text-slate-600">Commission carried in</label>
            <div className="flex gap-2">
              {(['cash', 'wallet'] as CommissionMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCommissionMode(m)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    commissionMode === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {m === 'cash' ? 'Fee in cash' : 'Fee in wallet'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Derived target — guided types only */}
        {isGuided && (
          <div data-testid="derived-target" className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div>
              Drawer should go <strong>{signed(derived.cashDelta)}</strong>
              {wallet && (
                <>
                  {', '}{wallet.name} <strong>{signed(derived.walletDelta)}</strong>
                </>
              )}
              {showCommission && <>{', profit '}<strong>{signed(commissionPaisa)}</strong></>}
            </div>
            <div className={matches ? 'text-emerald-600' : 'text-red-600'}>
              Net entered: {signed(actualNet)} {matches ? '✓ matches' : `(target ${signed(derived.cashDelta)})`}
            </div>
          </div>
        )}

        {/* Notes Received */}
        <NotePicker label="Notes Received" denominations={denominations} counts={notesIn} onChange={setNotesIn} />

        {/* Change Given */}
        <NotePicker label="Change Given" denominations={denominations} counts={notesOut} onChange={setNotesOut} />

        {/* Customer */}
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="customerName" className="mb-2 block text-sm font-semibold text-slate-600">Customer Name (optional)</label>
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
          <label htmlFor="customerPhone" className="mb-2 block text-sm font-semibold text-slate-600">Phone (optional)</label>
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
          <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-600">Note (optional)</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Rush order, Special request"
            rows={3}
          />
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate('/')} className="rounded-xl bg-slate-200 py-3 font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`rounded-xl py-3 font-semibold text-white ${
              isValid && !loading ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  )
}
