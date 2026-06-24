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

  it('back-fills adjustments for old data', () => {
    const old = {
      settings: { shopName: 'X', pin: '1234', denominations: [], expenseCategories: [] },
      wallets: [],
      drawer: {},
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const n = normalizeAppData(old)
    expect(n.adjustments).toEqual([])
  })
})

describe('normalizeAppData — transaction back-compat (legacy send/receive)', () => {
  it('remaps legacy send → deposit and receive → withdraw (label only)', () => {
    const data = {
      settings: { shopName: 'T', pin: '1234', denominations: [], expenseCategories: ['Bijli'] },
      wallets: [],
      drawer: {},
      transactions: [
        { id: 'a', type: 'send', walletId: null, walletDelta: -100, amount: 100, commission: 0, cashDelta: 100, createdAt: 'x' },
        { id: 'b', type: 'receive', walletId: null, walletDelta: 100, amount: 100, commission: 0, cashDelta: -100, createdAt: 'x' },
      ],
      cashMovements: [],
      persons: [],
      udharEntries: [],
      expenses: [],
      counts: [],
      adjustments: [],
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const out = normalizeAppData(data)
    expect(out.transactions[0].type).toBe('deposit')
    expect(out.transactions[1].type).toBe('withdraw')
    // balances/deltas untouched
    expect(out.transactions[0].walletDelta).toBe(-100)
    expect(out.transactions[1].cashDelta).toBe(-100)
  })

  it('back-fills commissionMode to cash when missing and preserves legacy discount', () => {
    const data = {
      settings: { shopName: 'T', pin: '1234', denominations: [], expenseCategories: ['Bijli'] },
      wallets: [],
      drawer: {},
      transactions: [
        { id: 'c', type: 'send', walletId: null, walletDelta: 0, amount: 100, commission: 5, discount: 2, cashDelta: 100, createdAt: 'x' },
      ],
      cashMovements: [],
      persons: [],
      udharEntries: [],
      expenses: [],
      counts: [],
      adjustments: [],
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const out = normalizeAppData(data)
    expect(out.transactions[0].commissionMode).toBe('cash')
    expect(out.transactions[0].discount).toBe(2)
  })

  it('leaves an already-migrated transaction unchanged', () => {
    const data = {
      settings: { shopName: 'T', pin: '1234', denominations: [], expenseCategories: ['Bijli'] },
      wallets: [],
      drawer: {},
      transactions: [
        { id: 'd', type: 'deposit', walletId: null, walletDelta: -100, amount: 100, commission: 5, commissionMode: 'wallet', cashDelta: 100, createdAt: 'x' },
      ],
      cashMovements: [],
      persons: [],
      udharEntries: [],
      expenses: [],
      counts: [],
      adjustments: [],
    } as unknown as Parameters<typeof normalizeAppData>[0]
    const out = normalizeAppData(data)
    expect(out.transactions[0].type).toBe('deposit')
    expect(out.transactions[0].commissionMode).toBe('wallet')
  })
})
