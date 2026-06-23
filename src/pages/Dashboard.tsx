import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useAppStore,
  selectTotalCash,
  selectBigTotal,
  selectSmallTotal,
} from '../store/appStore'
import { formatPKR } from '../domain/money'
import { todayLabel } from '../lib/formatDate'
import { summarize, todaysTransactions } from '../domain/summary'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const shopName = useAppStore((s) => s.data?.settings.shopName ?? 'PCO Shop')
  const wallets = useAppStore((s) => s.data?.wallets ?? [])
  const transactions = useAppStore((s) => s.data?.transactions ?? [])
  const total = useAppStore(selectTotalCash)
  const big = useAppStore(selectBigTotal)
  const small = useAppStore(selectSmallTotal)
  const today = useMemo(() => summarize(todaysTransactions(transactions, new Date())), [transactions])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">{shopName}</h1>
        <p className="text-sm text-slate-500">{todayLabel()}</p>
      </header>

      <section className="rounded-2xl bg-emerald-600 p-4 text-white">
        <div className="text-sm opacity-90">Total Cash</div>
        <div className="text-3xl font-extrabold">{formatPKR(total)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Bare Note (Big)</div>
            <div className="font-bold">{formatPKR(big)}</div>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Chote Note (Small)</div>
            <div className="font-bold">{formatPKR(small)}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Wallets</h2>
        <div className="grid grid-cols-2 gap-2">
          {wallets.map((w) => (
            <StatCard key={w.id} label={w.name} value={formatPKR(w.balance)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Today</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Transactions" value={String(today.count)} />
          <StatCard label="Profit" value={formatPKR(today.profit)} accent="text-emerald-600" />
          <StatCard label="Kharcha" value={formatPKR(0)} accent="text-red-600" />
          <StatCard label="Sent" value={formatPKR(today.sent)} />
          <StatCard label="Received" value={formatPKR(today.received)} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link to="/new" className="col-span-2 rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
          + New Transaction
        </Link>
        <Link to="/cash" className="rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
          Cash &amp; Notes
        </Link>
        <Link to="/transactions" className="rounded-xl bg-slate-200 py-3 text-center font-semibold">
          Transactions
        </Link>
      </section>
    </div>
  )
}
