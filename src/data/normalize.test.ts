import { describe, it, expect } from 'vitest'
import { normalizeAppData } from './normalize'

describe('normalizeAppData', () => {
  it('adds empty transactions and cashMovements when missing (old data)', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.transactions).toEqual([])
    expect(n.cashMovements).toEqual([])
  })

  it('preserves existing arrays', () => {
    const data = {
      settings: { shopName: 'X', pin: '1234', denominations: [] },
      wallets: [],
      drawer: {},
      transactions: [{ id: 't1' }],
      cashMovements: [{ id: 'c1' }],
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(data)
    expect(n.transactions).toHaveLength(1)
    expect(n.cashMovements).toHaveLength(1)
  })

  it('back-fills phase-3 fields and default categories for old data', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.persons).toEqual([])
    expect(n.udharEntries).toEqual([])
    expect(n.expenses).toEqual([])
    expect(n.settings.expenseCategories.length).toBeGreaterThan(0)
  })

  it('back-fills counts for old data', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [], expenseCategories: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.counts).toEqual([])
  })
})
