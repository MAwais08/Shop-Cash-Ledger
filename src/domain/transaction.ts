import type { Paisa } from './money'
import type { DrawerCounts } from './cash'
import { totalCash, applyNoteDelta } from './cash'
import { applyWalletDelta } from './wallet'
import type { AppData } from '../data/types'

export type TransactionType = 'easyload' | 'send' | 'receive' | 'package' | 'other'

export interface Transaction {
  id: string
  type: TransactionType
  walletId: string | null
  walletDelta: Paisa
  amount: Paisa
  commission: Paisa
  discount: Paisa
  cashDelta: Paisa
  customerName?: string
  customerPhone?: string
  note?: string
  createdAt: string
}

export interface CashMovement {
  id: string
  sourceType: 'transaction' | 'adjustment' | 'kharcha' | 'udhar' | 'count'
  sourceId: string
  delta: Paisa
  notes: Record<number, number>
  note?: string
  createdAt: string
}

export interface TransactionInput {
  id: string
  createdAt: string
  type: TransactionType
  walletId: string | null
  walletDelta: Paisa
  amount: Paisa
  commission: Paisa
  discount: Paisa
  notesIn: Record<number, number>
  notesOut: Record<number, number>
  customerName?: string
  customerPhone?: string
  note?: string
}

/** Combine received notes (+) and given-change notes (-) into one signed delta. */
export function mergeNoteDelta(
  notesIn: Record<number, number>,
  notesOut: Record<number, number>,
): Record<number, number> {
  const delta: Record<number, number> = {}
  for (const [value, count] of Object.entries(notesIn)) {
    if (count) delta[Number(value)] = (delta[Number(value)] ?? 0) + count
  }
  for (const [value, count] of Object.entries(notesOut)) {
    if (count) delta[Number(value)] = (delta[Number(value)] ?? 0) - count
  }
  for (const key of Object.keys(delta)) {
    if (delta[Number(key)] === 0) delete delta[Number(key)]
  }
  return delta
}

function negate(notes: Record<number, number>): Record<number, number> {
  const out: Record<number, number> = {}
  for (const [value, count] of Object.entries(notes)) out[Number(value)] = -count
  return out
}

/**
 * Remove a transaction and reverse its effects (wallet + drawer + cash movement).
 * Pure/immutable. Throws Error('NEGATIVE_NOTES') if reversing the notes would
 * make the drawer negative. Returns data unchanged if the id is not found.
 */
export function deleteTransaction(data: AppData, transactionId: string): AppData {
  const txn = data.transactions.find((t) => t.id === transactionId)
  if (!txn) return data

  const movement = data.cashMovements.find((m) => m.sourceId === transactionId)
  const drawer = movement ? applyNoteDelta(data.drawer, negate(movement.notes)) : data.drawer

  const wallets =
    txn.walletId === null || txn.walletDelta === 0
      ? data.wallets
      : data.wallets.map((w) =>
          w.id === txn.walletId ? applyWalletDelta(w, -txn.walletDelta) : w,
        )

  return {
    ...data,
    wallets,
    drawer,
    transactions: data.transactions.filter((t) => t.id !== transactionId),
    cashMovements: data.cashMovements.filter((m) => m.sourceId !== transactionId),
  }
}

/**
 * Apply a transaction to the app data, returning new data with the wallet,
 * drawer, transactions and cashMovements updated. Pure and immutable.
 * Throws Error('NEGATIVE_NOTES') if change given exceeds the drawer.
 */
export function applyTransaction(data: AppData, input: TransactionInput): AppData {
  const noteDelta = mergeNoteDelta(input.notesIn, input.notesOut)
  const cashDelta: Paisa = totalCash(input.notesIn) - totalCash(input.notesOut)

  const drawer: DrawerCounts = applyNoteDelta(data.drawer, noteDelta)

  const wallets =
    input.walletId === null || input.walletDelta === 0
      ? data.wallets
      : data.wallets.map((w) =>
          w.id === input.walletId ? applyWalletDelta(w, input.walletDelta) : w,
        )

  const transaction: Transaction = {
    id: input.id,
    type: input.type,
    walletId: input.walletId,
    walletDelta: input.walletDelta,
    amount: input.amount,
    commission: input.commission,
    discount: input.discount,
    cashDelta,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    note: input.note,
    createdAt: input.createdAt,
  }

  const cashMovements = [...data.cashMovements]
  if (cashDelta !== 0 || Object.keys(noteDelta).length > 0) {
    cashMovements.unshift({
      id: `${input.id}-c`,
      sourceType: 'transaction',
      sourceId: input.id,
      delta: cashDelta,
      notes: noteDelta,
      createdAt: input.createdAt,
    })
  }

  return {
    ...data,
    wallets,
    drawer,
    transactions: [transaction, ...data.transactions],
    cashMovements,
  }
}
