import type { Paisa } from './money'

/** One drawer verification snapshot. Immutable audit record. */
export interface Count {
  id: string
  /** totalCash(drawer) at the moment of the count. */
  expectedTotal: Paisa
  /** totalCash(countedNotes). */
  countedTotal: Paisa
  /** countedTotal − expectedTotal (signed; negative = short, positive = over). */
  difference: Paisa
  /** Reason; required by the UI when difference !== 0. */
  note?: string
  createdAt: string
}

export interface CountInput {
  id: string
  createdAt: string
  /** Per-denomination physical count of the whole drawer. */
  countedNotes: Record<number, number>
  note?: string
}
