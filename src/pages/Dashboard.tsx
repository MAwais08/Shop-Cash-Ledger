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
import {
  Plus,
  Receipt,
  Users,
  Calculator,
  Scale,
  Banknote,
  ArrowLeftRight,
  ChevronRight,
} from 'lucide-react'

const WALLET_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
]

const QUICK_ACTIONS = [
  { to: '/kharcha', icon: Receipt, label: 'Add Expense', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
  { to: '/udhari', icon: Users, label: 'Credit Ledger', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  { to: '/count', icon: Calculator, label: 'Count Cash', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  { to: '/adjustment', icon: Scale, label: 'Capital Adj.', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  { to: '/cash', icon: Banknote, label: 'Cash & Notes', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
]

const STAT_CARDS = (profit: string, profitCount: number, expenses: string, deposited: string, withdrawn: string) => [
  {
    label: 'Profit Today',
    value: profit,
    sub: `${profitCount} transaction${profitCount !== 1 ? 's' : ''}`,
    accent: 'border-t-emerald-500',
    valueColor: 'text-emerald-600',
  },
  {
    label: 'Expenses Today',
    value: expenses,
    sub: 'paid out',
    accent: 'border-t-rose-500',
    valueColor: 'text-rose-500',
  },
  {
    label: 'Deposited Today',
    value: deposited,
    sub: 'into wallets',
    accent: 'border-t-blue-500',
    valueColor: 'text-slate-900',
  },
  {
    label: 'Withdrawn Today',
    value: withdrawn,
    sub: 'from wallets',
    accent: 'border-t-amber-500',
    valueColor: 'text-slate-900',
  },
]

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
  const walletBalance = useMemo(
    () => wallets.reduce((sum, w) => sum + w.balance, 0),
    [wallets],
  )
  const todayExpenseTotal = useMemo(
    () => summarizeExpenses(todaysExpenses(expenses, new Date())).total,
    [expenses],
  )
  const udhar = useMemo(
    () => udharTotals(udharEntries, persons),
    [udharEntries, persons],
  )
  const worth = totalWorth(total, walletBalance, udhar.receivable, udhar.payable)

  const stats = STAT_CARDS(
    formatPKR(today.profit),
    today.count,
    formatPKR(todayExpenseTotal),
    formatPKR(today.deposited),
    formatPKR(today.withdrawn),
  )

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Page header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            {shopName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">{todayLabel()}</p>
        </div>
        <Link
          to="/new"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-200 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Transaction</span>
          <span className="sm:hidden">New</span>
        </Link>
      </header>

      {/* Row 1: Cash hero + Wallets */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Cash hero — dark emerald premium card */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white lg:col-span-2 lg:p-8">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-12 right-8 h-48 w-48 rounded-full bg-emerald-700/40" />
          <div className="pointer-events-none absolute bottom-16 right-40 h-20 w-20 rounded-full bg-white/5" />

          <div className="relative">
            <p className="text-sm font-medium text-emerald-300">Total Cash in Drawer</p>
            <p className="mt-2 text-5xl font-bold tracking-tight lg:text-6xl xl:text-7xl">
              {formatPKR(total)}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2.5 lg:gap-3">
              {[
                { label: 'Large Notes', value: formatPKR(big) },
                { label: 'Small Notes', value: formatPKR(small) },
                { label: 'Total Worth', value: formatPKR(worth) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 lg:p-4"
                >
                  <p className="text-xs font-medium text-emerald-300">{label}</p>
                  <p className="mt-1 text-base font-semibold lg:text-lg">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wallets */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Digital Wallets</h2>
            {wallets.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {wallets.length}
              </span>
            )}
          </div>

          {wallets.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No wallets added</p>
          ) : (
            <div className="space-y-1">
              {wallets.map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${WALLET_COLORS[i % WALLET_COLORS.length]}`}
                  >
                    {w.name[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-700">{w.name}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatPKR(w.balance)}
                  </span>
                </div>
              ))}
              {wallets.length > 1 && (
                <div className="mt-2 flex items-center justify-between border-t border-stone-100 px-2 pt-3">
                  <span className="text-xs font-medium text-slate-400">Total balance</span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatPKR(walletBalance)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Row 2: Today's stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {stats.map(({ label, value, sub, accent, valueColor }) => (
          <div
            key={label}
            className={`rounded-2xl border border-stone-200 border-t-4 bg-white p-4 lg:p-5 ${accent}`}
          >
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-bold lg:text-3xl ${valueColor}`}>{value}</p>
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Row 3: Credit Ledger + Quick Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Credit Ledger overview */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Credit Ledger</h2>
            <Link
              to="/udhari"
              className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
            >
              Open Ledger
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700">Receivable</p>
              <p className="mt-2 text-xl font-bold text-emerald-700">
                {formatPKR(udhar.receivable)}
              </p>
              <p className="mt-0.5 text-xs text-emerald-600 opacity-75">to collect</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-xs font-medium text-rose-700">Payable</p>
              <p className="mt-2 text-xl font-bold text-rose-600">
                {formatPKR(udhar.payable)}
              </p>
              <p className="mt-0.5 text-xs text-rose-500 opacity-75">to pay back</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {QUICK_ACTIONS.map(({ to, icon: Icon, label, iconBg, iconColor }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col items-center gap-2 rounded-xl p-3 transition-all hover:bg-slate-50"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-110 ${iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <span className="text-center text-xs font-medium leading-tight text-slate-500 transition-colors group-hover:text-slate-700">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
