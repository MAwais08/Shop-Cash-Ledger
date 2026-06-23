import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { applyNoteDelta, totalCash, negateNotes } from './cash'
import { applyWalletDelta } from './wallet'

/** Seed categories for a fresh shop; editable in Settings. */
export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Bijli',
  'Chai / Khana',
  'Rent',
  'Salary',
  'Maintenance',
  'Other',
]

export interface Expense {
  id: string
  category: string
  amount: Paisa
  payment: PaymentMethod
  /** Set when payment === 'wallet'; null for cash. */
  walletId: string | null
  note?: string
  createdAt: string
}

export interface ExpenseInput {
  id: string
  createdAt: string
  category: string
  amount: Paisa
  payment: PaymentMethod
  walletId: string | null
  /** Notes physically removed from the drawer (cash payment only). */
  notesOut: Record<number, number>
  note?: string
}

/** Apply a kharcha. Pure/immutable. Throws Error('NEGATIVE_NOTES') if a cash expense exceeds the drawer. */
export function applyExpense(data: AppData, input: ExpenseInput): AppData {
  const expense: Expense = {
    id: input.id,
    category: input.category,
    amount: input.amount,
    payment: input.payment,
    walletId: input.payment === 'wallet' ? input.walletId : null,
    note: input.note,
    createdAt: input.createdAt,
  }

  if (input.payment === 'wallet') {
    const wallets = data.wallets.map((w) =>
      w.id === input.walletId ? applyWalletDelta(w, -input.amount) : w,
    )
    return { ...data, wallets, expenses: [expense, ...data.expenses] }
  }

  // cash
  const noteDelta = negateNotes(input.notesOut)
  const cashDelta: Paisa = -totalCash(input.notesOut)
  const drawer = applyNoteDelta(data.drawer, noteDelta)
  const movement: CashMovement = {
    id: `${input.id}-c`,
    sourceType: 'kharcha',
    sourceId: input.id,
    delta: cashDelta,
    notes: noteDelta,
    note: input.note,
    createdAt: input.createdAt,
  }
  return {
    ...data,
    drawer,
    expenses: [expense, ...data.expenses],
    cashMovements: [movement, ...data.cashMovements],
  }
}

/** Remove a kharcha and reverse its effect. Returns data unchanged if not found. */
export function deleteExpense(data: AppData, expenseId: string): AppData {
  const expense = data.expenses.find((e) => e.id === expenseId)
  if (!expense) return data

  if (expense.payment === 'wallet') {
    const wallets = data.wallets.map((w) =>
      w.id === expense.walletId ? applyWalletDelta(w, expense.amount) : w,
    )
    return { ...data, wallets, expenses: data.expenses.filter((e) => e.id !== expenseId) }
  }

  // cash: re-add the notes (negate the stored negative delta)
  const movement = data.cashMovements.find((m) => m.sourceId === expenseId)
  const drawer = movement ? applyNoteDelta(data.drawer, negateNotes(movement.notes)) : data.drawer
  return {
    ...data,
    drawer,
    expenses: data.expenses.filter((e) => e.id !== expenseId),
    cashMovements: data.cashMovements.filter((m) => m.sourceId !== expenseId),
  }
}
