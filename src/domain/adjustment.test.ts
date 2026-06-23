import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyAdjustment, deleteAdjustment, type AdjustmentInput } from './adjustment'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5, 100: 8 }, // Rs 5800
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}

function inp(over: Partial<AdjustmentInput> = {}): AdjustmentInput {
  return { id: 'adj1', createdAt: '2026-06-23T10:00:00.000Z', ...over }
}

describe('applyAdjustment — cash only', () => {
  it('adds notes to drawer, logs a positive adjustment movement, records snapshot', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 1000: 2 } }))
    expect(next.drawer[1000]).toBe(7)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('adjustment')
    expect(next.cashMovements[0].sourceId).toBe('adj1')
    expect(next.cashMovements[0].delta).toBe(2000_00)
    expect(next.cashMovements[0].notes).toEqual({ 1000: 2 })
    expect(next.adjustments).toHaveLength(1)
    expect(next.adjustments[0].id).toBe('adj1')
    expect(next.adjustments[0].cashDelta).toBe(2000_00)
    expect(next.adjustments[0].walletId).toBeNull()
    expect(next.adjustments[0].walletDelta).toBe(0)
    expect(next.wallets[0].balance).toBe(5000_00) // wallet untouched
  })

  it('removes notes from drawer with negative cashNotes, logs negative delta', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 1000: -3 } }))
    expect(next.drawer[1000]).toBe(2)
    expect(next.cashMovements[0].delta).toBe(-3000_00)
    expect(next.adjustments[0].cashDelta).toBe(-3000_00)
  })

  it('throws NEGATIVE_NOTES when removing more notes than the drawer holds', () => {
    expect(() => applyAdjustment(baseData(), inp({ cashNotes: { 1000: -6 } }))).toThrow('NEGATIVE_NOTES')
  })

  it('golden invariant holds after adding cash', () => {
    const start = baseData()
    const next = applyAdjustment(start, inp({ cashNotes: { 500: 4 } }))
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + movementSum)
  })

  it('golden invariant holds after removing cash', () => {
    const start = baseData()
    const next = applyAdjustment(start, inp({ cashNotes: { 100: -3 } }))
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + movementSum)
  })
})

describe('applyAdjustment — wallet only', () => {
  it('increases wallet balance, no CashMovement, snapshot records walletId and walletDelta', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ walletId: 'easypaisa', walletDelta: 3000_00 }))
    expect(next.wallets[0].balance).toBe(8000_00)
    expect(next.cashMovements).toHaveLength(0)
    expect(next.adjustments[0].walletId).toBe('easypaisa')
    expect(next.adjustments[0].walletDelta).toBe(3000_00)
    expect(next.adjustments[0].cashDelta).toBe(0)
    expect(next.adjustments[0].notes).toEqual({})
    expect(next.drawer).toEqual(data.drawer)
  })

  it('decreases wallet balance with negative walletDelta', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ walletId: 'easypaisa', walletDelta: -2000_00 }))
    expect(next.wallets[0].balance).toBe(3000_00)
    expect(next.adjustments[0].walletDelta).toBe(-2000_00)
  })
})

describe('applyAdjustment — cash + wallet', () => {
  it('moves both cash and wallet, one movement and one snapshot', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 500: 2 }, walletId: 'easypaisa', walletDelta: 1000_00 }))
    expect(next.drawer[500]).toBe(2)
    expect(next.wallets[0].balance).toBe(6000_00)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].delta).toBe(1000_00)
    expect(next.adjustments[0].cashDelta).toBe(1000_00)
    expect(next.adjustments[0].walletDelta).toBe(1000_00)
    expect(next.adjustments[0].walletId).toBe('easypaisa')
  })
})

describe('applyAdjustment — no-op (nothing specified)', () => {
  it('still records a snapshot with zero deltas, no CashMovement', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp())
    expect(next.adjustments).toHaveLength(1)
    expect(next.adjustments[0].cashDelta).toBe(0)
    expect(next.adjustments[0].walletDelta).toBe(0)
    expect(next.cashMovements).toHaveLength(0)
    expect(next.drawer).toEqual(data.drawer)
    expect(next.wallets[0].balance).toBe(5000_00)
  })
})

describe('applyAdjustment — immutability', () => {
  it('does not mutate the input data', () => {
    const data = baseData()
    applyAdjustment(data, inp({ cashNotes: { 1000: 1 } }))
    expect(data.drawer[1000]).toBe(5)
    expect(data.adjustments).toHaveLength(0)
    expect(data.cashMovements).toHaveLength(0)
  })

  it('does not touch transactions, expenses, or persons', () => {
    const data = baseData()
    const next = applyAdjustment(data, inp({ cashNotes: { 1000: 1 } }))
    expect(next.transactions).toBe(data.transactions)
    expect(next.expenses).toBe(data.expenses)
    expect(next.persons).toBe(data.persons)
  })
})

describe('deleteAdjustment', () => {
  it('reverses a cash adjustment: drawer restored, movement dropped, record removed', () => {
    const after = applyAdjustment(baseData(), inp({ cashNotes: { 1000: 2 }, id: 'adj1' }))
    const reverted = deleteAdjustment(after, 'adj1')
    expect(reverted.drawer[1000]).toBe(5)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.adjustments).toHaveLength(0)
  })

  it('reverses a wallet adjustment: balance restored, record removed', () => {
    const after = applyAdjustment(baseData(), inp({ walletId: 'easypaisa', walletDelta: 3000_00, id: 'adj1' }))
    const reverted = deleteAdjustment(after, 'adj1')
    expect(reverted.wallets[0].balance).toBe(5000_00)
    expect(reverted.adjustments).toHaveLength(0)
  })

  it('reverses both cash and wallet in one adjustment', () => {
    const after = applyAdjustment(baseData(), inp({
      cashNotes: { 100: -3 },    // remove 3 × Rs100 (drawer had 8, leaves 5)
      walletId: 'easypaisa',
      walletDelta: -2000_00,      // remove Rs 2000 from wallet (had 5000, leaves 3000)
      id: 'adj1',
    }))
    expect(after.drawer[100]).toBe(5)
    expect(after.wallets[0].balance).toBe(3000_00)

    const reverted = deleteAdjustment(after, 'adj1')
    expect(reverted.drawer[100]).toBe(8)
    expect(reverted.wallets[0].balance).toBe(5000_00)
    expect(reverted.adjustments).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
  })

  it('returns data unchanged for an unknown id', () => {
    const after = applyAdjustment(baseData(), inp({ cashNotes: { 1000: 1 } }))
    const result = deleteAdjustment(after, 'nope')
    expect(result.adjustments).toHaveLength(1)
    expect(result.cashMovements).toHaveLength(1)
  })
})
