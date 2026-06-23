import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

type Direction = 'add' | 'remove'

export default function Adjustment() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addAdjustment = useAppStore((s) => s.addAdjustment)
  const deleteAdjustment = useAppStore((s) => s.deleteAdjustment)

  const [direction, setDirection] = useState<Direction>('add')
  const [cashNotes, setCashNotes] = useState<Record<number, number>>({})
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletAmount, setWalletAmount] = useState<number>(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive from data before the early-return guard (hooks must be unconditional)
  const denominations = data?.settings.denominations ?? []
  const wallets = data?.wallets ?? []
  const drawer = data?.drawer ?? {}
  const adjustments = data?.adjustments ?? []

  const hasCashNotes = useMemo(() => Object.values(cashNotes).some((n) => n > 0), [cashNotes])
  const cashNotesTotal = useMemo(() => totalCash(cashNotes), [cashNotes])

  if (!data) return <div className="p-8">Loading…</div>

  const walletAmountPaisa = toPaisa(walletAmount)
  const hasWallet = walletId !== null && walletAmountPaisa > 0
  const sign = direction === 'add' ? 1 : -1
  const newCashTotal = totalCash(drawer) + sign * cashNotesTotal
  const selectedWallet = wallets.find((w) => w.id === walletId)
  const newWalletBalance = selectedWallet ? selectedWallet.balance + sign * walletAmountPaisa : null
  const walletWouldGoNegative =
    direction === 'remove' && hasWallet && newWalletBalance !== null && newWalletBalance < 0
  const canSubmit = !loading && (hasCashNotes || hasWallet) && !walletWouldGoNegative

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const effectNotes: Record<number, number> = {}
      for (const [d, count] of Object.entries(cashNotes)) {
        if (count > 0) effectNotes[Number(d)] = sign * count
      }
      await addAdjustment({
        cashNotes: hasCashNotes ? effectNotes : undefined,
        walletId: hasWallet ? walletId : null,
        walletDelta: hasWallet ? sign * walletAmountPaisa : undefined,
        note: note.trim() || undefined,
      })
      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? "Drawer doesn't have those notes. Reduce the amount and try again."
          : 'Could not save. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Add / Remove Money</h1>
        <p className="text-sm text-slate-500">Adjust your own cash or wallet balance.</p>
      </header>

      <div className="flex gap-2 rounded-xl border bg-white p-3">
        {(['add', 'remove'] as Direction[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              direction === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {d === 'add' ? 'Add money' : 'Take money out'}
          </button>
        ))}
      </div>

      <NotePicker
        label={direction === 'add' ? 'Notes to Add' : 'Notes to Remove'}
        denominations={denominations}
        counts={cashNotes}
        onChange={setCashNotes}
      />

      {wallets.length > 0 && (
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <label htmlFor="wallet-select" className="block text-sm font-semibold text-slate-600">
            Wallet (optional)
          </label>
          <select
            id="wallet-select"
            aria-label="Wallet"
            value={walletId ?? ''}
            onChange={(e) => {
              setWalletId(e.target.value || null)
              setWalletAmount(0)
            }}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">— No wallet —</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({formatPKR(w.balance)})
              </option>
            ))}
          </select>
          {walletId && (
            <div>
              <label htmlFor="walletAmount" className="mb-1 block text-xs font-semibold text-slate-600">
                Amount (Rs)
              </label>
              <input
                id="walletAmount"
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2"
                min="0"
                step="0.01"
              />
              {walletWouldGoNegative && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Amount exceeds wallet balance ({formatPKR(selectedWallet!.balance)}).
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-white p-3">
        <label htmlFor="adj-note" className="mb-2 block text-sm font-semibold text-slate-600">
          Reason (optional)
        </label>
        <input
          id="adj-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="e.g., added savings, withdrew for house expense"
        />
      </div>

      {(hasCashNotes || hasWallet) && (
        <section className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-slate-500">Preview</p>
          {hasCashNotes && (
            <div className="flex justify-between">
              <span>New cash total</span>
              <span className="font-semibold">{formatPKR(newCashTotal)}</span>
            </div>
          )}
          {hasWallet && newWalletBalance !== null && (
            <div className="flex justify-between">
              <span>{selectedWallet?.name} balance</span>
              <span className={`font-semibold ${newWalletBalance < 0 ? 'text-red-600' : ''}`}>
                {formatPKR(newWalletBalance)}
              </span>
            </div>
          )}
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => navigate('/')} className="rounded-xl bg-slate-200 py-3 font-semibold">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`rounded-xl py-3 font-semibold text-white ${
            canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-400'
          }`}
        >
          {loading ? 'Saving…' : 'Confirm'}
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">History</h2>
        {adjustments.length === 0 && <p className="text-sm text-slate-500">No adjustments yet.</p>}
        <ul className="space-y-1">
          {adjustments.slice(0, 20).map((a) => {
            const wallet = wallets.find((w) => w.id === a.walletId)
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-slate-400">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
                <span className="min-w-0 flex-1">
                  {a.cashDelta !== 0 && (
                    <span className={`mr-2 ${a.cashDelta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      Cash {a.cashDelta > 0 ? '+' : ''}
                      {formatPKR(a.cashDelta)}
                    </span>
                  )}
                  {wallet && a.walletDelta !== 0 && (
                    <span className={a.walletDelta > 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {wallet.name} {a.walletDelta > 0 ? '+' : ''}
                      {formatPKR(a.walletDelta)}
                    </span>
                  )}
                  {a.note && <span className="ml-1 text-slate-400">"{a.note}"</span>}
                </span>
                <button
                  type="button"
                  onClick={() => deleteAdjustment(a.id)}
                  className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600"
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
