import type { AppData } from './types'
import { DEFAULT_EXPENSE_CATEGORIES } from '../domain/expense'

/** Fill in fields that old persisted data may lack (back-compat). */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      expenseCategories: data.settings.expenseCategories ?? [...DEFAULT_EXPENSE_CATEGORIES],
    },
    transactions: data.transactions ?? [],
    cashMovements: data.cashMovements ?? [],
    persons: data.persons ?? [],
    udharEntries: data.udharEntries ?? [],
    expenses: data.expenses ?? [],
  }
}
