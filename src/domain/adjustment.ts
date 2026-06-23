import type { Paisa } from './money'

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
