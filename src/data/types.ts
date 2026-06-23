import type { Denomination } from '../domain/denominations'
import type { Wallet } from '../domain/wallet'
import type { DrawerCounts } from '../domain/cash'
import type { Transaction, CashMovement } from '../domain/transaction'

export interface Settings {
  shopName: string
  pin: string
  denominations: Denomination[]
}

export interface AppData {
  settings: Settings
  wallets: Wallet[]
  drawer: DrawerCounts
  transactions: Transaction[]
  cashMovements: CashMovement[]
}
