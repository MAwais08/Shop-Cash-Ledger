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
import {
  summarize,
  todaysTransactions,
  summarizeExpenses,
  todaysExpenses,
  totalWorth,
} from '../domain/summary'
import { udharTotals } from '../domain/udhar'
import { Plus, Receipt, Users, Calculator, Scale, Banknote, ArrowLeftRight } from 'lucide-react'

export default function Dashboard() {
  const shopName = useAppStore((s) => s.data?.settings.shopName ?? 'PCO Shop')
  const wallets = useAppStore((s) => s.data?.wallets ?? [])
  const transactions = useAppStore((s) => s.data?.transactions ?? [])
  const expenses = useAppStore((s) => s.data?.expenses ?? [])
  const persons = useAppStore((s) => s.data?.persons ?? [])
  const udharEntries = useAppStore((s) => s.data?.udharEntries ?? [])
  const total = useAppStore(selectTotalCash)
  const big = useAppStore(selectBigTotal)
  const small = useAppStore(selectSmallTotal)
  const today = useMemo(
    () => summarize(todaysTransactions(transactions, new Date())),
    [transactions],
  )
  const walletBalance = useMemo(() => wallets.reduce((sum, w) => sum + w.balance, 0), [wallets])
  const todayExpenseTotal = useMemo(
    () => summarizeExpenses(todaysExpenses(expenses, new Date())).total,
    [expenses],
  )
  const udhar = useMemo(() => udharTotals(udharEntries, persons), [udharEntries, persons])
  const worth = totalWorth(total, walletBalance, udhar.receivable, udhar.payable)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">{shopName}</h1>
        <p className="text-sm text-slate-500">{todayLabel()}</p>
      </header>

      {/* Cash hero card */}
      <section className="rounded-2xl bg-emerald-600 p-4 text-white">
        <div className="text-sm opacity-90">Total Cash in Drawer</div>
        <div className="text-3xl font-extrabold">{formatPKR(total)}</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Large Notes</div>
            <div className="font-bold">{formatPKR(big)}</div>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Small Notes</div>
            <div className="font-bold">{formatPKR(small)}</div>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Total Worth</div>
            <div className="font-bold">{formatPKR(worth)}</div>
          </div>
        </div>
      </section>

      {/* Wallets + Today side-by-side on wider screens */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wallets
          </h2>
          <div className="space-y-2">
            {wallets.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="text-sm text-slate-700">{w.name}</span>
                <span className="text-sm font-semibold text-slate-900">{formatPKR(w.balance)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Today
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <div className="text-xs text-slate-500">Profit</div>
              <div className="text-base font-bold text-emerald-600">{formatPKR(today.profit)}</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <div className="text-xs text-slate-500">Expenses</div>
              <div className="text-base font-bold text-red-600">{formatPKR(todayExpenseTotal)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <div className="text-xs text-slate-500">Deposited</div>
              <div className="text-base font-bold text-slate-900">{formatPKR(today.deposited)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <div className="text-xs text-slate-500">Withdrawn</div>
              <div className="text-base font-bold text-slate-900">{formatPKR(today.withdrawn)}</div>
            </div>
          </div>
        </section>
      </div>

      {/* Quick actions */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/new"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            New Transaction
          </Link>
          <Link
            to="/kharcha"
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Receipt className="h-4 w-4" />
            Add Expense
          </Link>
          <Link
            to="/udhari"
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Users className="h-4 w-4" />
            Credit Ledger
          </Link>
          <Link
            to="/count"
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Calculator className="h-4 w-4" />
            Count Cash
          </Link>
          <Link
            to="/adjustment"
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Scale className="h-4 w-4" />
            Capital Adjustment
          </Link>
          <Link
            to="/cash"
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Banknote className="h-4 w-4" />
            Cash & Notes
          </Link>
          <Link
            to="/transactions"
            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Transactions
          </Link>
        </div>
      </section>
    </div>
  )
}
