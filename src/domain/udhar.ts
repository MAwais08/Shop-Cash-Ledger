import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'

export interface Person {
  id: string
  name: string
  phone?: string
}

/** 'given' = shop pays the person (they now owe the shop); 'repayment' = person pays the shop back. */
export type UdharType = 'given' | 'repayment'

export interface UdharEntry {
  id: string
  personId: string
  type: UdharType
  amount: Paisa
  payment: PaymentMethod
  /** Set when payment === 'wallet'; null for cash. */
  walletId: string | null
  note?: string
  createdAt: string
}
