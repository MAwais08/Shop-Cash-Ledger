import type { AppData } from './types'

/** Fill in fields that old persisted data may lack (back-compat). */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    transactions: data.transactions ?? [],
    cashMovements: data.cashMovements ?? [],
  }
}
