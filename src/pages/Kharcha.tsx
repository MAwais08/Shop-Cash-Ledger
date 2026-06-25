import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { PaymentMethod } from '../domain/wallet'
import { toPaisa, formatPKR } from '../domain/money'
import { totalCash } from '../domain/cash'
import { summarizeExpenses, todaysExpenses } from '../domain/summary'
import NotePicker from '../components/NotePicker'

export default function Kharcha() {
  const navigate = useNavigate()
  const data = useAppStore((s) => s.data)
  const addExpense = useAppStore((s) => s.addExpense)

  const [category, setCategory] = useState<string>(data?.settings.expenseCategories[0] ?? 'Other')
  const [amount, setAmount] = useState<number>(0)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [walletId, setWalletId] = useState<string | null>(data?.wallets[0]?.id ?? null)
  const [notesOut, setNotesOut] = useState<Record<number, number>>({})
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rawExpenses = data?.expenses
  const todayTotal = useMemo(
    () => summarizeExpenses(todaysExpenses(rawExpenses ?? [], new Date())).total,
    [rawExpenses],
  )
  const expenses = rawExpenses ?? []

  if (!data) return <div className="p-8">Loading…</div>

  const amountPaisa = toPaisa(amount)
  const cashOut = totalCash(notesOut)
  const isValid = amountPaisa > 0 && (payment === 'cash' ? cashOut > 0 : !!walletId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await addExpense({
        category,
        amount: amountPaisa,
        payment,
        walletId: payment === 'wallet' ? walletId : null,
        notesOut: payment === 'cash' ? notesOut : {},
        note: note || undefined,
      })
      setAmount(0)
      setNotesOut({})
      setNote('')
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? 'Cash paid exceeds the drawer. Adjust the notes and try again.'
          : 'Could not save the expense. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Expenses</h1>
        <div className="text-right text-sm">
          <div className="text-slate-500">Today</div>
          <div className="font-bold text-red-600">{formatPKR(todayTotal)}</div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-xl border bg-white p-3">
          <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-600">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          >
            {data.settings.expenseCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
          <span className="mb-2 block text-sm font-semibold text-slate-600">Paid from</span>
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
            label="Notes Paid"
            denominations={data.settings.denominations}
            counts={notesOut}
            onChange={setNotesOut}
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
            onClick={() => navigate('/')}
            className="rounded-xl bg-slate-200 py-3 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`rounded-xl py-3 font-semibold text-white ${
              isValid && !loading ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-400'
            }`}
          >
            {loading ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Recent</h2>
        <ul className="space-y-1">
          {expenses.slice(0, 20).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
            >
              <span>
                {e.category}{' '}
                <span className="text-slate-400">· {e.payment}</span>
              </span>
              <span className="font-semibold text-red-600">-{formatPKR(e.amount)}</span>
            </li>
          ))}
          {expenses.length === 0 && (
            <li className="text-sm text-slate-400">No expenses yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
