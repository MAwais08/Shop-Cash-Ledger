import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { searchTransactions } from '../domain/summary'
import { formatPKR } from '../domain/money'
import type { TransactionType } from '../domain/transaction'

const TYPE_LABEL: Record<TransactionType, string> = {
  easyload: 'Easyload', deposit: 'Deposit', withdraw: 'Withdraw', package: 'Package', other: 'Other',
}

function dateKey(iso: string) {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function formatDateHeading(isoDay: string) {
  const d = new Date(isoDay + 'T00:00:00')
  const todayKey = dateKey(new Date().toISOString())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayKey = dateKey(yesterdayDate.toISOString())
  if (isoDay === todayKey) return 'Today'
  if (isoDay === yesterdayKey) return 'Yesterday'
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Transactions() {
  const data = useAppStore((s) => s.data)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!data) return null

  const filtered = useMemo(() => {
    let list = searchTransactions(data.transactions, query)
    if (dateFilter) list = list.filter((t) => dateKey(t.createdAt) === dateFilter)
    return list
  }, [data.transactions, query, dateFilter])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const t of filtered) {
      const k = dateKey(t.createdAt)
      const arr = map.get(k) ?? []
      arr.push(t)
      map.set(k, arr)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteTransaction(id)
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'NEGATIVE_NOTES'
          ? 'Cannot delete: the cash from this transaction is no longer in the drawer.'
          : 'Could not delete the transaction. Please try again.',
      )
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Transactions</h1>
      <div className="flex gap-2">
        <input
          placeholder="Search by name, phone, or note"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm text-slate-600"
        />
        {dateFilter && (
          <button
            type="button"
            onClick={() => setDateFilter('')}
            className="rounded-lg border px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}
      {groups.length === 0 && <p className="text-sm text-slate-500">No transactions.</p>}
      <div className="space-y-4">
        {groups.map(([day, txns]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {formatDateHeading(day)}
            </h2>
            <ul className="space-y-2">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
                  <div>
                    <div className="font-semibold">
                      {TYPE_LABEL[t.type]} · {formatPKR(t.amount)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.customerName || '—'} {t.customerPhone ? `· ${t.customerPhone}` : ''}
                    </div>
                    <div className="text-xs text-slate-400">
                      Cash {t.cashDelta >= 0 ? '+' : ''}{formatPKR(t.cashDelta)} · Profit {formatPKR(t.commission - (t.discount ?? 0))}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`delete ${t.id}`}
                    onClick={() => handleDelete(t.id)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
