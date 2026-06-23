import type { Paisa } from './money'
import type { AppData } from '../data/types'
import type { CashMovement } from './transaction'
import { totalCash, applyNoteDelta, diffNotes } from './cash'

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

/** Reconcile the drawer to a physical count. Pure/immutable. Always records a Count snapshot;
 *  records a 'count' CashMovement only when the count differs from the expected drawer total. */
export function applyCount(data: AppData, input: CountInput): AppData {
  const expectedTotal: Paisa = totalCash(data.drawer)
  const countedTotal: Paisa = totalCash(input.countedNotes)
  const difference: Paisa = countedTotal - expectedTotal

  const count: Count = {
    id: input.id,
    expectedTotal,
    countedTotal,
    difference,
    note: input.note,
    createdAt: input.createdAt,
  }

  if (difference === 0) {
    return { ...data, counts: [count, ...data.counts] }
  }

  const noteDelta = diffNotes(input.countedNotes, data.drawer)
  const drawer = applyNoteDelta(data.drawer, noteDelta)
  const movement: CashMovement = {
    id: `${input.id}-c`,
    sourceType: 'count',
    sourceId: input.id,
    delta: difference,
    notes: noteDelta,
    note: input.note,
    createdAt: input.createdAt,
  }
  return {
    ...data,
    drawer,
    counts: [count, ...data.counts],
    cashMovements: [movement, ...data.cashMovements],
  }
}
