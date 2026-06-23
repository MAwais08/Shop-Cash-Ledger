import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'

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
