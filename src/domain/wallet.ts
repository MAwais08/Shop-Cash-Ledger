import type { Paisa } from './money'

export interface Wallet {
  id: string
  name: string
  balance: Paisa
}

export function applyWalletDelta(w: Wallet, deltaPaisa: Paisa): Wallet {
  return { ...w, balance: w.balance + deltaPaisa }
}

export function profit(commissionPaisa: Paisa, discountPaisa: Paisa): Paisa {
  return commissionPaisa - discountPaisa
}
