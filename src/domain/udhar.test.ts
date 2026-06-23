import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyUdhar, deleteUdhar, personBalance, udharTotals, type UdharInput } from './udhar'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 1000: 5 }, // Rs 5000 in drawer
    transactions: [],
    cashMovements: [],
    persons: [{ id: 'p1', name: 'Ali' }],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}

const given: UdharInput = {
  id: 'u1',
  createdAt: '2026-06-23T10:00:00.000Z',
  personId: 'p1',
  type: 'given',
  amount: 2000_00,
  payment: 'cash',
  walletId: null,
  notes: { 1000: 2 },
}

describe('applyUdhar (cash given)', () => {
  it('removes cash, logs a udhar movement, records the entry', () => {
    const next = applyUdhar(baseData(), given)
    expect(next.drawer[1000]).toBe(3)
    expect(next.udharEntries).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('udhar')
    expect(next.cashMovements[0].delta).toBe(-2000_00)
  })

  it('keeps the golden invariant', () => {
    const start = baseData()
    const next = applyUdhar(start, given)
    const sum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + sum)
  })

  it('throws NEGATIVE_NOTES when giving more cash than the drawer holds', () => {
    expect(() => applyUdhar(baseData(), { ...given, id: 'u9', notes: { 1000: 6 } })).toThrow('NEGATIVE_NOTES')
  })
})

describe('applyUdhar (cash repayment)', () => {
  const repay: UdharInput = { ...given, id: 'u2', type: 'repayment', amount: 500_00, notes: { 100: 5 } }
  it('adds cash and logs a positive movement', () => {
    const next = applyUdhar(baseData(), repay)
    expect(next.cashMovements[0].delta).toBe(500_00)
    expect(next.drawer[100]).toBe(5)
  })
})

describe('applyUdhar (wallet)', () => {
  it('given via wallet decreases the balance, no cash movement', () => {
    const next = applyUdhar(baseData(), { ...given, id: 'u3', payment: 'wallet', walletId: 'easypaisa', notes: {} })
    expect(next.wallets[0].balance).toBe(3000_00)
    expect(next.cashMovements).toHaveLength(0)
  })
  it('repayment via wallet increases the balance', () => {
    const next = applyUdhar(baseData(), { ...given, id: 'u4', type: 'repayment', amount: 1000_00, payment: 'wallet', walletId: 'easypaisa', notes: {} })
    expect(next.wallets[0].balance).toBe(6000_00)
  })
})

describe('personBalance + udharTotals', () => {
  it('nets given minus repayment per person', () => {
    let data = applyUdhar(baseData(), given) // p1 owes 2000
    data = applyUdhar(data, { ...given, id: 'u5', type: 'repayment', amount: 500_00, notes: { 100: 5 } }) // pays 500
    expect(personBalance(data.udharEntries, 'p1')).toBe(1500_00)
  })

  it('splits receivable and payable across people', () => {
    const data: AppData = {
      ...baseData(),
      persons: [{ id: 'p1', name: 'Ali' }, { id: 'p2', name: 'Sara' }],
      udharEntries: [
        { id: 'a', personId: 'p1', type: 'given', amount: 1000_00, payment: 'cash', walletId: null, createdAt: '' },
        { id: 'b', personId: 'p2', type: 'repayment', amount: 700_00, payment: 'cash', walletId: null, createdAt: '' },
      ],
    }
    expect(udharTotals(data.udharEntries, data.persons)).toEqual({ receivable: 1000_00, payable: 700_00 })
  })
})

describe('deleteUdhar', () => {
  it('reverses a cash given entry', () => {
    const after = applyUdhar(baseData(), given)
    const reverted = deleteUdhar(after, 'u1')
    expect(reverted.udharEntries).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.drawer[1000]).toBe(5)
  })
  it('reverses a wallet given entry', () => {
    const after = applyUdhar(baseData(), { ...given, id: 'u6', payment: 'wallet', walletId: 'easypaisa', notes: {} })
    const reverted = deleteUdhar(after, 'u6')
    expect(reverted.wallets[0].balance).toBe(5000_00)
  })
  it('returns data unchanged for an unknown id', () => {
    const after = applyUdhar(baseData(), given)
    expect(deleteUdhar(after, 'nope').udharEntries).toHaveLength(1)
  })
})
