import type { AppData } from './types'
import type { TransactionType } from '../domain/transaction'
import { DEFAULT_EXPENSE_CATEGORIES } from '../domain/expense'

const LEGACY_TYPE: Record<string, TransactionType> = {
  send: 'deposit',
  receive: 'withdraw',
}

/** Fill in fields that old persisted data may lack (back-compat).
 *  Remaps legacy send/receive transaction types to deposit/withdraw.
 *  Back-fills commissionMode to 'cash' when missing. */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      expenseCategories: data.settings.expenseCategories ?? [...DEFAULT_EXPENSE_CATEGORIES],
    },
    transactions: (data.transactions ?? []).map((t) => ({
      ...t,
      type: LEGACY_TYPE[t.type as string] ?? t.type,
      commissionMode: t.commissionMode ?? 'cash',
    })),
    cashMovements: data.cashMovements ?? [],
    persons: data.persons ?? [],
    udharEntries: data.udharEntries ?? [],
    expenses: data.expenses ?? [],
    counts: data.counts ?? [],
    adjustments: data.adjustments ?? [],
  }
}
