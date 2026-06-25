import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { PaymentMethod } from '../domain/wallet'
import type { UdharType } from '../domain/udhar'
import { personBalance } from '../domain/udhar'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import NotePicker from '../components/NotePicker'

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addUdhar = useAppStore((s) => s.addUdhar)

  const [type, setType] = useState<UdharType>('given')
  const [amount, setAmount] = useState<number>(0)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [notes, setNotes] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const person = data?.persons.find((p) => p.id === personId)
  const balance = useMemo(
    () => personBalance(data?.udharEntries ?? [], personId ?? ''),
    [data, personId],
  )
  const mine = useMemo(
    () => (data?.udharEntries ?? []).filter((e) => e.personId === personId),
    [data, personId],
  )

  if (!data) return <div className="p-8">Loading…</div>
  if (!person) return (
    <div className="p-8">
      Person not found.{' '}
      <Link to="/udhari" className="text-emerald-600">Back</Link>
    </div>
  )

  const amountPaisa = toPaisa(amount)
  const cashTotal = totalCash(notes)
  const isValid = amountPaisa > 0 && (payment === 'cash' ? cashTotal > 0 : !!walletId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await addUdhar({
        personId: person.id,
        type,
        amount: amountPaisa,
        payment,
        walletId: payment === 'wallet' ? walletId : null,
        notes: payment === 'cash' ? notes : {},
        note: note || undefined,
      })
      setAmount(0)
      setNotes({})
      setNote('')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? 'Cash given exceeds the drawer. Adjust the notes and try again.'
          : 'Could not save. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{person.name}</h1>
          {person.phone && <p className="text-sm text-slate-500">{person.phone}</p>}
        </div>
        <div className="text-right text-sm">
          <div className="text-slate-500">{balance >= 0 ? 'Owes you' : 'You owe'}</div>
          <div className={`font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPKR(Math.abs(balance))}
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          {(['given', 'repayment'] as UdharType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                type === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {t === 'given' ? 'Udhar diya (out)' : 'Wapsi li (in)'}
            </button>
          ))}
        </div>

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
          <span className="mb-2 block text-sm font-semibold text-slate-600">Settled by</span>
          <div className="flex gap-2">
            {(['cash', 'wallet'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPayment(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                  payment === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {m === 'cash' ? 'Cash' : 'Wallet'}
              </button>
            ))}
          </div>
        </div>

        {payment === 'wallet' ? (
          <div className="rounded-xl border bg-white p-3">
            <label htmlFor="wallet" className="mb-2 block text-sm font-semibold text-slate-600">
              Wallet
            </label>
            <select
              id="wallet"
              value={walletId ?? ''}
              onChange={(e) => setWalletId(e.target.value || null)}
              className="w-full rounded-lg border px-3 py-2"
            >
              {data.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatPKR(w.balance)})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <NotePicker
            label={type === 'given' ? 'Notes Out' : 'Notes In'}
            denominations={data.settings.denominations}
            counts={notes}
            onChange={setNotes}
          />
        )}

        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-600">
            Note (optional)
          </label>
          <input
            id="note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/udhari')}
            className="rounded-xl bg-slate-200 py-3 font-semibold"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`rounded-xl py-3 font-semibold text-white ${
              isValid && !loading
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'cursor-not-allowed bg-slate-400'
            }`}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">History</h2>
        <ul className="space-y-1">
          {mine.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
            >
              <span>
                {e.type === 'given' ? 'Given' : 'Repayment'}{' '}
                <span className="text-slate-400">· {e.payment}</span>
              </span>
              <span
                className={`font-semibold ${
                  e.type === 'given' ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {e.type === 'given' ? '-' : '+'}{formatPKR(e.amount)}
              </span>
            </li>
          ))}
          {mine.length === 0 && (
            <li className="text-sm text-slate-400">No entries yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
