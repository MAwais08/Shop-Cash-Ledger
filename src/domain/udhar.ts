import type { Paisa } from './money'
import type { PaymentMethod } from './wallet'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { applyNoteDelta, totalCash, negateNotes } from './cash'
import { applyWalletDelta } from './wallet'

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

export interface UdharInput {
  id: string
  createdAt: string
  personId: string
  type: UdharType
  amount: Paisa
  payment: PaymentMethod
  walletId: string | null
  /** Notes leaving (given) or arriving (repayment) — cash only. */
  notes: Record<number, number>
  note?: string
}

/** Net of given minus repayment for one person. Positive ⇒ the person owes the shop. */
export function personBalance(entries: UdharEntry[], personId: string): Paisa {
  let bal = 0
  for (const e of entries) {
    if (e.personId !== personId) continue
    bal += e.type === 'given' ? e.amount : -e.amount
  }
  return bal
}

export function udharTotals(
  entries: UdharEntry[],
  persons: Person[],
): { receivable: Paisa; payable: Paisa } {
  let receivable = 0
  let payable = 0
  for (const p of persons) {
    const bal = personBalance(entries, p.id)
    if (bal > 0) receivable += bal
    else if (bal < 0) payable += -bal
  }
  return { receivable, payable }
}

/** Apply an udhar entry. Pure/immutable. Throws Error('NEGATIVE_NOTES') if a cash 'given' exceeds the drawer. */
export function applyUdhar(data: AppData, input: UdharInput): AppData {
  const entry: UdharEntry = {
    id: input.id,
    personId: input.personId,
    type: input.type,
    amount: input.amount,
    payment: input.payment,
    walletId: input.payment === 'wallet' ? input.walletId : null,
    note: input.note,
    createdAt: input.createdAt,
  }
  const outward = input.type === 'given' // money leaving the shop

  if (input.payment === 'wallet') {
    const delta = outward ? -input.amount : input.amount
    const wallets = data.wallets.map((w) =>
      w.id === input.walletId ? applyWalletDelta(w, delta) : w,
    )
    return { ...data, wallets, udharEntries: [entry, ...data.udharEntries] }
  }

  // cash
  const noteDelta = outward ? negateNotes(input.notes) : input.notes
  const cashTotal = totalCash(input.notes)
  const cashDelta: Paisa = outward ? -cashTotal : cashTotal
  const drawer = applyNoteDelta(data.drawer, noteDelta)
  const movement: CashMovement = {
    id: `${input.id}-c`,
    sourceType: 'udhar',
    sourceId: input.id,
    delta: cashDelta,
    notes: noteDelta,
    note: input.note,
    createdAt: input.createdAt,
  }
  return {
    ...data,
    drawer,
    udharEntries: [entry, ...data.udharEntries],
    cashMovements: [movement, ...data.cashMovements],
  }
}

/** Remove an udhar entry and reverse its effect. Returns data unchanged if not found. Throws NEGATIVE_NOTES if the drawer can no longer reverse it. */
export function deleteUdhar(data: AppData, entryId: string): AppData {
  const entry = data.udharEntries.find((e) => e.id === entryId)
  if (!entry) return data

  if (entry.payment === 'wallet') {
    const reverse = entry.type === 'given' ? entry.amount : -entry.amount
    const wallets = data.wallets.map((w) =>
      w.id === entry.walletId ? applyWalletDelta(w, reverse) : w,
    )
    return { ...data, wallets, udharEntries: data.udharEntries.filter((e) => e.id !== entryId) }
  }

  const movement = data.cashMovements.find((m) => m.sourceId === entryId)
  const drawer = movement ? applyNoteDelta(data.drawer, negateNotes(movement.notes)) : data.drawer
  return {
    ...data,
    drawer,
    udharEntries: data.udharEntries.filter((e) => e.id !== entryId),
    cashMovements: data.cashMovements.filter((m) => m.sourceId !== entryId),
  }
}
