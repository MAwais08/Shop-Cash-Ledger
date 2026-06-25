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
    <div className="space-y-4 lg:space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">{shopName}</h1>
          <p className="text-sm text-slate-500">{todayLabel()}</p>
        </div>
        <Link
          to="/new"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          <span>New Transaction</span>
        </Link>
      </header>

      {/* Top row: Cash hero + Wallets side by side at lg */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Cash hero — spans 2 cols on lg */}
        <section className="rounded-2xl bg-emerald-600 p-5 text-white lg:col-span-2">
          <div className="text-sm opacity-90">Total Cash in Drawer</div>
          <div className="mt-1 text-4xl font-extrabold lg:text-5xl">{formatPKR(total)}</div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-xs opacity-80">Large Notes</div>
              <div className="mt-1 text-lg font-bold">{formatPKR(big)}</div>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-xs opacity-80">Small Notes</div>
              <div className="mt-1 text-lg font-bold">{formatPKR(small)}</div>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-xs opacity-80">Total Worth</div>
              <div className="mt-1 text-lg font-bold">{formatPKR(worth)}</div>
            </div>
          </div>
        </section>

        {/* Wallets — 1 col on lg */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wallets
          </h2>
          <div className="space-y-2">
            {wallets.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
              >
                <span className="text-sm text-slate-700">{w.name}</span>
                <span className="text-sm font-semibold text-slate-900">{formatPKR(w.balance)}</span>
              </div>
            ))}
            {wallets.length > 1 && (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</span>
                <span className="text-sm font-bold text-slate-900">{formatPKR(walletBalance)}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Middle row: Today stats + Credit summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profit Today</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{formatPKR(today.profit)}</div>
          <div className="mt-1 text-xs text-slate-400">{today.count} transaction{today.count !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expenses Today</div>
          <div className="mt-2 text-2xl font-bold text-red-500">{formatPKR(todayExpenseTotal)}</div>
          <div className="mt-1 text-xs text-slate-400">paid out</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deposited Today</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatPKR(today.deposited)}</div>
          <div className="mt-1 text-xs text-slate-400">into wallets</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Withdrawn Today</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatPKR(today.withdrawn)}</div>
          <div className="mt-1 text-xs text-slate-400">from wallets</div>
        </div>
      </div>

      {/* Credit summary + Quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Credit overview */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Credit Ledger
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-xs text-slate-500">Receivable</div>
              <div className="mt-1 text-base font-bold text-emerald-600">{formatPKR(udhar.receivable)}</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <div className="text-xs text-slate-500">Payable</div>
              <div className="mt-1 text-base font-bold text-red-500">{formatPKR(udhar.payable)}</div>
            </div>
          </div>
          <Link
            to="/udhari"
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            <Users className="h-3 w-3" />
            Open Ledger
          </Link>
        </section>

        {/* Quick actions — spans 2 cols on lg */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2 lg:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
            <Link
              to="/kharcha"
              className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Receipt className="h-5 w-5 text-orange-500" />
              Add Expense
            </Link>
            <Link
              to="/udhari"
              className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Users className="h-5 w-5 text-blue-500" />
              Credit Ledger
            </Link>
            <Link
              to="/count"
              className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Calculator className="h-5 w-5 text-purple-500" />
              Count Cash
            </Link>
            <Link
              to="/adjustment"
              className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Scale className="h-5 w-5 text-yellow-600" />
              Capital Adj.
            </Link>
            <Link
              to="/cash"
              className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Banknote className="h-5 w-5 text-emerald-600" />
              Cash & Notes
            </Link>
            <Link
              to="/transactions"
              className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeftRight className="h-5 w-5 text-slate-500" />
              Transactions
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
