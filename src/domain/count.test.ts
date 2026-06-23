import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyCount, type CountInput } from './count'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5, 100: 8 }, // Rs 5000 + 800 = 5800
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}

function input(over: Partial<CountInput> = {}): CountInput {
  return { id: 'cnt1', createdAt: '2026-06-23T10:00:00.000Z', countedNotes: {}, ...over }
}

describe('applyCount', () => {
  it('matched count: no movement, drawer unchanged, snapshot with difference 0', () => {
    const data = baseData()
    const next = applyCount(data, input({ countedNotes: { 1000: 5, 100: 8 } }))
    expect(next.cashMovements).toHaveLength(0)
    expect(next.drawer).toEqual(data.drawer)
    expect(next.counts).toHaveLength(1)
    expect(next.counts[0].difference).toBe(0)
    expect(next.counts[0].expectedTotal).toBe(5800_00)
    expect(next.counts[0].countedTotal).toBe(5800_00)
  })

  it('short count: drawer corrected down, negative count movement, golden invariant holds', () => {
    const data = baseData()
    // physically only 4 × 1000 and 8 × 100 = Rs 4800 (Rs 1000 short)
    const next = applyCount(data, input({ countedNotes: { 1000: 4, 100: 8 }, note: 'missing note' }))
    expect(next.drawer[1000]).toBe(4)
    expect(next.drawer[100]).toBe(8)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('count')
    expect(next.cashMovements[0].delta).toBe(-1000_00)
    expect(next.counts[0].difference).toBe(-1000_00)
    expect(next.counts[0].note).toBe('missing note')
    expect(totalCash(next.drawer)).toBe(4800_00)
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(data.drawer) + movementSum).toBe(totalCash(next.drawer))
  })

  it('over count: drawer up, positive movement', () => {
    const data = baseData()
    // physically 6 × 1000 and 8 × 100 = Rs 6800 (Rs 1000 over)
    const next = applyCount(data, input({ countedNotes: { 1000: 6, 100: 8 }, note: 'found note' }))
    expect(next.drawer[1000]).toBe(6)
    expect(next.cashMovements[0].delta).toBe(1000_00)
    expect(next.counts[0].difference).toBe(1000_00)
  })

  it('drawer becomes exactly the counted notes', () => {
    const data = baseData()
    const next = applyCount(data, input({ countedNotes: { 5000: 1, 500: 2 }, note: 'recount' }))
    expect(next.drawer[5000]).toBe(1)
    expect(next.drawer[500]).toBe(2)
    expect(next.drawer[1000]).toBe(0)
    expect(next.drawer[100]).toBe(0)
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyCount(data, input({ countedNotes: { 1000: 4, 100: 8 } }))
    expect(data.drawer[1000]).toBe(5)
    expect(data.counts).toHaveLength(0)
    expect(data.cashMovements).toHaveLength(0)
  })
})
