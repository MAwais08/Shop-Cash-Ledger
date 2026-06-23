import type { Paisa } from './money'
import type { Transaction } from './transaction'
import type { Expense } from './expense'

export interface DaySummary {
  count: number
  sent: Paisa
  received: Paisa
  commission: Paisa
  discount: Paisa
  profit: Paisa
}

export function summarize(transactions: Transaction[]): DaySummary {
  const s: DaySummary = { count: 0, sent: 0, received: 0, commission: 0, discount: 0, profit: 0 }
  for (const t of transactions) {
    s.count += 1
    if (t.type === 'send') s.sent += t.amount
    if (t.type === 'receive') s.received += t.amount
    s.commission += t.commission
    s.discount += t.discount
  }
  s.profit = s.commission - s.discount
  return s
}

export function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return (
    d.getUTCFullYear() === ref.getUTCFullYear() &&
    d.getUTCMonth() === ref.getUTCMonth() &&
    d.getUTCDate() === ref.getUTCDate()
  )
}

export function todaysTransactions(transactions: Transaction[], ref: Date): Transaction[] {
  return transactions.filter((t) => isSameDay(t.createdAt, ref))
}

export function searchTransactions(transactions: Transaction[], query: string): Transaction[] {
  const q = query.trim().toLowerCase()
  if (!q) return transactions
  return transactions.filter((t) =>
    [t.customerName, t.customerPhone, t.note]
      .filter((v): v is string => Boolean(v))
      .some((v) => v.toLowerCase().includes(q)),
  )
}

export function walletStats(
  transactions: Transaction[],
  walletId: string,
): { sent: Paisa; received: Paisa; commission: Paisa; discount: Paisa } {
  const s = { sent: 0, received: 0, commission: 0, discount: 0 }
  for (const t of transactions) {
    if (t.walletId !== walletId) continue
    if (t.type === 'send') s.sent += t.amount
    if (t.type === 'receive') s.received += t.amount
    s.commission += t.commission
    s.discount += t.discount
  }
  return s
}

export interface ExpenseSummary {
  total: Paisa
  byCategory: Record<string, Paisa>
}

export function summarizeExpenses(expenses: Expense[]): ExpenseSummary {
  const byCategory: Record<string, Paisa> = {}
  let total = 0
  for (const e of expenses) {
    total += e.amount
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
  }
  return { total, byCategory }
}

export function todaysExpenses(expenses: Expense[], ref: Date): Expense[] {
  return expenses.filter((e) => isSameDay(e.createdAt, ref))
}

/** Net worth: drawer cash + all wallet balances + money owed to the shop − money the shop owes. */
export function totalWorth(cash: Paisa, walletBalance: Paisa, receivable: Paisa, payable: Paisa): Paisa {
  return cash + walletBalance + receivable - payable
}
