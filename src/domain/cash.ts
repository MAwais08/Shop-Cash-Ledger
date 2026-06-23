import type { Paisa } from './money'
import { type Denomination, isBigValue } from './denominations'

/** Note value (rupees) -> count held. */
export type DrawerCounts = Record<number, number>

export function totalCash(counts: DrawerCounts): Paisa {
  let rupees = 0
  for (const [value, count] of Object.entries(counts)) {
    rupees += Number(value) * count
  }
  return Math.round(rupees * 100)
}

export function bigTotal(counts: DrawerCounts, denoms: Denomination[]): Paisa {
  return subtotal(counts, (v) => isBigValue(v, denoms))
}

export function smallTotal(counts: DrawerCounts, denoms: Denomination[]): Paisa {
  return subtotal(counts, (v) => !isBigValue(v, denoms))
}

function subtotal(counts: DrawerCounts, include: (value: number) => boolean): Paisa {
  let rupees = 0
  for (const [value, count] of Object.entries(counts)) {
    const v = Number(value)
    if (include(v)) rupees += v * count
  }
  return Math.round(rupees * 100)
}

export function applyNoteDelta(
  counts: DrawerCounts,
  delta: Record<number, number>,
): DrawerCounts {
  const next: DrawerCounts = { ...counts }
  for (const [value, change] of Object.entries(delta)) {
    const v = Number(value)
    const result = (next[v] ?? 0) + change
    if (result < 0) throw new Error('NEGATIVE_NOTES')
    next[v] = result
  }
  return next
}

export function emptyDrawer(denoms: Denomination[]): DrawerCounts {
  const drawer: DrawerCounts = {}
  for (const d of denoms) drawer[d.value] = 0
  return drawer
}

/** Flip the sign of every count in a note map. */
export function negateNotes(notes: Record<number, number>): Record<number, number> {
  const out: Record<number, number> = {}
  for (const [value, count] of Object.entries(notes)) out[Number(value)] = -count
  return out
}

/** Per-denomination signed delta to turn `current` into `target`. Omits zero deltas. */
export function diffNotes(
  target: Record<number, number>,
  current: Record<number, number>,
): Record<number, number> {
  const out: Record<number, number> = {}
  const values = new Set<number>([
    ...Object.keys(target).map(Number),
    ...Object.keys(current).map(Number),
  ])
  for (const v of values) {
    const delta = (target[v] ?? 0) - (current[v] ?? 0)
    if (delta !== 0) out[v] = delta
  }
  return out
}
