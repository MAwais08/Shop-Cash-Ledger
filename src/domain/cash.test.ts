import { describe, it, expect } from 'vitest'
import { DEFAULT_DENOMINATIONS } from './denominations'
import {
  type DrawerCounts,
  totalCash,
  bigTotal,
  smallTotal,
  applyNoteDelta,
  emptyDrawer,
  negateNotes,
  diffNotes,
} from './cash'

const sample: DrawerCounts = { 5000: 2, 1000: 3, 100: 5, 10: 4 }
// 10000 + 3000 + 500 + 40 = 13540 rupees

describe('cash drawer math', () => {
  it('totals all notes in paisa', () => {
    expect(totalCash(sample)).toBe(1354000)
  })

  it('totals big notes only', () => {
    expect(bigTotal(sample, DEFAULT_DENOMINATIONS)).toBe(1300000) // 13000
  })

  it('totals small notes only', () => {
    expect(smallTotal(sample, DEFAULT_DENOMINATIONS)).toBe(54000) // 540
  })

  it('big + small equals total', () => {
    const big = bigTotal(sample, DEFAULT_DENOMINATIONS)
    const small = smallTotal(sample, DEFAULT_DENOMINATIONS)
    expect(big + small).toBe(totalCash(sample))
  })

  it('applies a positive note delta', () => {
    const next = applyNoteDelta(sample, { 5000: 1, 100: -2 })
    expect(next[5000]).toBe(3)
    expect(next[100]).toBe(3)
  })

  it('throws when a delta would make a count negative', () => {
    expect(() => applyNoteDelta(sample, { 10: -5 })).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input counts', () => {
    applyNoteDelta(sample, { 5000: 1 })
    expect(sample[5000]).toBe(2)
  })

  it('builds an empty drawer with a zero count per denomination', () => {
    const drawer = emptyDrawer(DEFAULT_DENOMINATIONS)
    expect(drawer[5000]).toBe(0)
    expect(drawer[1]).toBe(0)
    expect(totalCash(drawer)).toBe(0)
  })
})

describe('negateNotes', () => {
  it('flips the sign of every count', () => {
    expect(negateNotes({ 5000: 1, 100: 2 })).toEqual({ 5000: -1, 100: -2 })
  })
  it('returns an empty map unchanged', () => {
    expect(negateNotes({})).toEqual({})
  })
})

describe('diffNotes', () => {
  it('returns the signed per-denomination delta to reach target from current', () => {
    expect(diffNotes({ 100: 5, 50: 2 }, { 100: 3, 50: 2 })).toEqual({ 100: 2 })
  })
  it('includes negative deltas and values present only on one side', () => {
    expect(diffNotes({ 100: 1, 500: 0 }, { 100: 3, 50: 1 })).toEqual({ 100: -2, 50: -1 })
  })
  it('returns an empty map when target equals current', () => {
    expect(diffNotes({ 100: 3 }, { 100: 3 })).toEqual({})
  })
})
