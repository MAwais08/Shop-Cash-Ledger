import type { Paisa } from './money'
import type { DrawerCounts } from './cash'
import { totalCash, applyNoteDelta } from './cash'
import { applyWalletDelta } from './wallet'
import type { AppData } from '../data/types'

export type TransactionType = 'deposit' | 'withdraw' | 'easyload' | 'package' | 'other'

export type CommissionMode = 'cash' | 'wallet'

export interface Transaction {
  id: string
  type: TransactionType
  walletId: string | null
  walletDelta: Paisa
  amount: Paisa
  commission: Paisa
  commissionMode: CommissionMode
  cashDelta: Paisa
  /** Legacy only; omitted on new transactions. */
  discount?: Paisa
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
  amount: Paisa
  commission: Paisa
  commissionMode: CommissionMode
  notesIn: Record<number, number>
  notesOut: Record<number, number>
  /** Manual signed wallet delta — used ONLY by type 'other'. Ignored for guided types. */
  walletDelta?: Paisa
  customerName?: string
  customerPhone?: string
  note?: string
}

/**
 * Derive the signed wallet and cash movements for a guided transaction.
 * `amount` is the transfer amount; `commission` is the shop's fee. Signs are
 * from the shop's view. Pure/deterministic. For deposit/withdraw, total worth
 * rises by exactly `commission`; easyload/package net to zero. `other` is not
 * derived here — the caller supplies its deltas.
 */
export function deriveMovements(
  type: TransactionType,
  amount: Paisa,
  commission: Paisa,
  commissionMode: CommissionMode,
): { walletDelta: Paisa; cashDelta: Paisa } {
  switch (type) {
    case 'deposit':
      return commissionMode === 'cash'
        ? { cashDelta: amount + commission, walletDelta: -amount }
        : { cashDelta: amount, walletDelta: -(amount - commission) }
    case 'withdraw':
      return commissionMode === 'cash'
        ? { cashDelta: -(amount - commission), walletDelta: amount }
        : { cashDelta: -amount, walletDelta: amount + commission }
    case 'easyload':
    case 'package':
      return { cashDelta: amount, walletDelta: -amount }
    default:
      return { cashDelta: 0, walletDelta: 0 }
  }
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
 *
 * Guided types (deposit/withdraw/easyload/package) derive their wallet and cash
 * deltas from `deriveMovements`; the entered notes MUST net to the derived cash
 * target or this throws Error('CASH_MISMATCH'). easyload/package force
 * commission to 0. Type 'other' is the manual escape hatch: it uses the
 * supplied `walletDelta` and notes with no derivation or reconciliation.
 * Throws Error('NEGATIVE_NOTES') if change given exceeds the drawer.
 */
export function applyTransaction(data: AppData, input: TransactionInput): AppData {
  const isGuided = input.type !== 'other'
  const commission: Paisa =
    input.type === 'easyload' || input.type === 'package' ? 0 : input.commission

  const actual: Paisa = totalCash(input.notesIn) - totalCash(input.notesOut)

  let walletDelta: Paisa
  let cashDelta: Paisa
  if (isGuided) {
    const derived = deriveMovements(input.type, input.amount, commission, input.commissionMode)
    walletDelta = derived.walletDelta
    cashDelta = derived.cashDelta
    if (actual !== cashDelta) throw new Error('CASH_MISMATCH')
  } else {
    walletDelta = input.walletDelta ?? 0
    cashDelta = actual
  }

  const noteDelta = mergeNoteDelta(input.notesIn, input.notesOut)
  const drawer: DrawerCounts = applyNoteDelta(data.drawer, noteDelta)

  const wallets =
    input.walletId === null || walletDelta === 0
      ? data.wallets
      : data.wallets.map((w) =>
          w.id === input.walletId ? applyWalletDelta(w, walletDelta) : w,
        )

  const transaction: Transaction = {
    id: input.id,
    type: input.type,
    walletId: input.walletId,
    walletDelta,
    amount: input.amount,
    commission,
    commissionMode: input.commissionMode,
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
      note: input.note,
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
