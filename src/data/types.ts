import type { Denomination } from '../domain/denominations'
import type { Wallet } from '../domain/wallet'
import type { DrawerCounts } from '../domain/cash'
import type { Transaction, CashMovement } from '../domain/transaction'
import type { Expense } from '../domain/expense'
import type { Person, UdharEntry } from '../domain/udhar'

export interface Settings {
  shopName: string
  pin: string
  denominations: Denomination[]
  expenseCategories: string[]
}

export interface AppData {
  settings: Settings
  wallets: Wallet[]
  drawer: DrawerCounts
  transactions: Transaction[]
  cashMovements: CashMovement[]
  persons: Person[]
  udharEntries: UdharEntry[]
  expenses: Expense[]
}
