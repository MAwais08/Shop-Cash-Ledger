import type { Paisa } from './money'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { applyNoteDelta, totalCash, negateNotes } from './cash'
import { applyWalletDelta } from './wallet'

export interface Adjustment {
  id: string
  /** Signed paisa change to the drawer (0 if no cash change). */
  cashDelta: Paisa
  /** Signed per-denomination delta applied to the drawer ({} if no cash change). */
  notes: Record<number, number>
  /** Wallet touched, or null if this adjustment did not touch a wallet. */
  walletId: string | null
  /** Signed paisa change to the wallet (0 if no wallet). */
  walletDelta: Paisa
  note?: string
  createdAt: string
}

export interface AdjustmentInput {
  id: string
  createdAt: string
  /** Signed per-denomination delta. Positive = add notes, negative = remove notes.
   *  Empty or omitted = no cash change. The UI negates counts for "Take money out". */
  cashNotes?: Record<number, number>
  /** Target wallet id; null or omitted = no wallet change. */
  walletId?: string | null
  /** Signed paisa change to the wallet. Positive = add, negative = remove. */
  walletDelta?: Paisa
  note?: string
}

/** Apply a capital adjustment. Pure/immutable. Throws Error('NEGATIVE_NOTES') if cash removal exceeds the drawer. */
export function applyAdjustment(data: AppData, input: AdjustmentInput): AppData {
  const cashNotes = input.cashNotes ?? {}
  const walletDelta = input.walletDelta ?? 0
  const walletId = input.walletId ?? null

  const hasCash = Object.values(cashNotes).some((n) => n !== 0)
  const hasWallet = walletId !== null && walletDelta !== 0

  // Cash part — applyNoteDelta may throw NEGATIVE_NOTES
  const drawer = hasCash ? applyNoteDelta(data.drawer, cashNotes) : data.drawer
  const cashDelta: Paisa = hasCash ? totalCash(cashNotes) : 0

  const newMovement: CashMovement | null = hasCash
    ? {
        id: `${input.id}-c`,
        sourceType: 'adjustment',
        sourceId: input.id,
        delta: cashDelta,
        notes: cashNotes,
        note: input.note,
        createdAt: input.createdAt,
      }
    : null

  // Wallet part
  const wallets = hasWallet
    ? data.wallets.map((w) => (w.id === walletId ? applyWalletDelta(w, walletDelta) : w))
    : data.wallets

  // Snapshot
  const adjustment: Adjustment = {
    id: input.id,
    cashDelta,
    notes: hasCash ? cashNotes : {},
    walletId: hasWallet ? walletId : null,
    walletDelta: hasWallet ? walletDelta : 0,
    note: input.note,
    createdAt: input.createdAt,
  }

  return {
    ...data,
    drawer,
    wallets,
    cashMovements: newMovement ? [newMovement, ...data.cashMovements] : data.cashMovements,
    adjustments: [adjustment, ...data.adjustments],
  }
}

/** Remove a capital adjustment and fully reverse its effect. Returns data unchanged if not found. */
export function deleteAdjustment(data: AppData, adjustmentId: string): AppData {
  const adjustment = data.adjustments.find((a) => a.id === adjustmentId)
  if (!adjustment) return data

  // Reverse cash
  let drawer = data.drawer
  let cashMovements = data.cashMovements
  if (adjustment.cashDelta !== 0) {
    const movement = data.cashMovements.find((m) => m.sourceId === adjustmentId)
    if (movement) {
      drawer = applyNoteDelta(data.drawer, negateNotes(movement.notes))
      cashMovements = data.cashMovements.filter((m) => m.sourceId !== adjustmentId)
    }
  }

  // Reverse wallet
  const wallets =
    adjustment.walletId !== null && adjustment.walletDelta !== 0
      ? data.wallets.map((w) =>
          w.id === adjustment.walletId ? applyWalletDelta(w, -adjustment.walletDelta) : w,
        )
      : data.wallets

  return {
    ...data,
    drawer,
    wallets,
    cashMovements,
    adjustments: data.adjustments.filter((a) => a.id !== adjustmentId),
  }
}
