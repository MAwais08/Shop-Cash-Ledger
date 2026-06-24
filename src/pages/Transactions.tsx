import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { searchTransactions } from '../domain/summary'
import { formatPKR } from '../domain/money'
import type { TransactionType } from '../domain/transaction'

const TYPE_LABEL: Record<TransactionType, string> = {
  easyload: 'Easyload', deposit: 'Deposit', withdraw: 'Withdraw', package: 'Package', other: 'Other',
}

export default function Transactions() {
  const data = useAppStore((s) => s.data)
  const deleteTransaction = useAppStore((s) => s.deleteTransaction)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!data) return null

  const list = searchTransactions(data.transactions, query)

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
      <input
        placeholder="Search by name, phone, or note"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border px-3 py-2"
      />
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}
      {list.length === 0 && <p className="text-sm text-slate-500">No transactions.</p>}
      <ul className="space-y-2">
        {list.map((t) => (
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
    </div>
  )
}
