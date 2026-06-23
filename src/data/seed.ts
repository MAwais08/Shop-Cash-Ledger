import type { AppData } from './types'
import { DEFAULT_DENOMINATIONS } from '../domain/denominations'
import { emptyDrawer } from '../domain/cash'
import { DEFAULT_EXPENSE_CATEGORIES } from '../domain/expense'

export function seedData(): AppData {
  return {
    settings: {
      shopName: 'My PCO Shop',
      pin: '1234',
      denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })),
      expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    },
    wallets: [
      { id: 'easypaisa', name: 'Easypaisa', balance: 0 },
      { id: 'jazzcash', name: 'JazzCash', balance: 0 },
      { id: 'bank', name: 'Bank', balance: 0 },
    ],
    drawer: emptyDrawer(DEFAULT_DENOMINATIONS),
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
  }
}
