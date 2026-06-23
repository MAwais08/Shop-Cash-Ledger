import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, selectTotalCash } from '../store/appStore'
import { formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

export default function CountDrawer() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const expected = useAppStore(selectTotalCash)
  const recordCount = useAppStore((s) => s.recordCount)

  const [counted, setCounted] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countedTotal = useMemo(() => totalCash(counted), [counted])
  const difference = countedTotal - expected
  const counts = data?.counts ?? []

  if (!data) return <div className="p-8">Loading…</div>

  const denominations = data.settings.denominations
  const needsReason = difference !== 0
  const canSubmit = !loading && (!needsReason || reason.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await recordCount({ countedNotes: counted, note: needsReason ? reason.trim() : undefined })
      navigate('/')
    } catch {
      setError('Could not save the count. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Count &amp; Verify</h1>
        <p className="text-sm text-slate-500">Count the drawer note by note.</p>
      </header>

      <NotePicker
        label="Counted Notes"
        denominations={denominations}
        counts={counted}
        onChange={setCounted}
      />

      <section className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><span>Expected</span><span className="font-semibold">{formatPKR(expected)}</span></div>
        <div className="flex justify-between"><span>Counted</span><span className="font-semibold">{formatPKR(countedTotal)}</span></div>
        <div className="flex justify-between">
          <span>Difference</span>
          <span className={`font-bold ${difference === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {difference === 0 ? 'Matches ✓' : `${difference > 0 ? 'Over +' : 'Short '}${formatPKR(difference)}`}
          </span>
        </div>
      </section>

      {needsReason && (
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="reason" className="mb-2 block text-sm font-semibold text-slate-600">
            Reason (required)
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., chai, found note, miscount"
          />
        </div>
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
          className={`rounded-xl py-3 font-semibold text-white ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'}`}
        >
          {loading ? 'Saving…' : 'Confirm & Reconcile'}
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Count History</h2>
        {counts.length === 0 && <p className="text-sm text-slate-500">No counts yet.</p>}
        <ul className="space-y-1">
          {counts.slice(0, 20).map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
              <span className="text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
              <span className="font-semibold">{formatPKR(c.countedTotal)}</span>
              <span className={c.difference === 0 ? 'text-emerald-600' : 'text-red-600'}>
                {c.difference === 0 ? '✓ matched' : `${c.difference > 0 ? '+' : ''}${formatPKR(c.difference)}${c.note ? ` "${c.note}"` : ''}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
