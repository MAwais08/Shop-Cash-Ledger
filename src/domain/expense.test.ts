import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyExpense, deleteExpense, type ExpenseInput } from './expense'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: ['Bijli'] },
    wallets: [{ id: 'easypaisa', name: 'Easypaisa', balance: 5000_00 }],
    drawer: { ...emptyDrawer(DEFAULT_DENOMINATIONS), 100: 10 }, // Rs 1000 in drawer
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
  }
}

const cashExpense: ExpenseInput = {
  id: 'e1',
  createdAt: '2026-06-23T10:00:00.000Z',
  category: 'Bijli',
  amount: 300_00,
  payment: 'cash',
  walletId: null,
  notesOut: { 100: 3 },
}

describe('applyExpense (cash)', () => {
  it('removes notes from the drawer and logs a kharcha cash movement', () => {
    const next = applyExpense(baseData(), cashExpense)
    expect(next.drawer[100]).toBe(7)
    expect(next.expenses).toHaveLength(1)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('kharcha')
    expect(next.cashMovements[0].delta).toBe(-300_00)
  })

  it('keeps the golden invariant (drawer === starting cash + sum of movements)', () => {
    const start = baseData()
    const next = applyExpense(start, cashExpense)
    const movementSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(totalCash(start.drawer) + movementSum)
  })

  it('does not touch any wallet', () => {
    const next = applyExpense(baseData(), cashExpense)
    expect(next.wallets[0].balance).toBe(5000_00)
  })

  it('throws NEGATIVE_NOTES when cash paid exceeds the drawer', () => {
    const input: ExpenseInput = { ...cashExpense, id: 'e2', notesOut: { 100: 11 } }
    expect(() => applyExpense(baseData(), input)).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyExpense(data, cashExpense)
    expect(data.expenses).toHaveLength(0)
    expect(data.drawer[100]).toBe(10)
  })
})

describe('applyExpense (wallet)', () => {
  const walletExpense: ExpenseInput = {
    id: 'e3',
    createdAt: '2026-06-23T10:00:00.000Z',
    category: 'Bijli',
    amount: 1200_00,
    payment: 'wallet',
    walletId: 'easypaisa',
    notesOut: {},
  }

  it('decreases the wallet and logs no cash movement', () => {
    const next = applyExpense(baseData(), walletExpense)
    expect(next.wallets[0].balance).toBe(3800_00)
    expect(next.cashMovements).toHaveLength(0)
    expect(next.drawer[100]).toBe(10)
    expect(next.expenses[0].payment).toBe('wallet')
  })
})

describe('deleteExpense', () => {
  it('reverses a cash expense (drawer + movement + record)', () => {
    const after = applyExpense(baseData(), cashExpense)
    const reverted = deleteExpense(after, 'e1')
    expect(reverted.expenses).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.drawer[100]).toBe(10)
  })

  it('reverses a wallet expense', () => {
    const input: ExpenseInput = { id: 'e4', createdAt: '2026-06-23T10:00:00.000Z', category: 'Bijli', amount: 1000_00, payment: 'wallet', walletId: 'easypaisa', notesOut: {} }
    const after = applyExpense(baseData(), input)
    const reverted = deleteExpense(after, 'e4')
    expect(reverted.wallets[0].balance).toBe(5000_00)
    expect(reverted.expenses).toHaveLength(0)
  })

  it('returns data unchanged for an unknown id', () => {
    const after = applyExpense(baseData(), cashExpense)
    expect(deleteExpense(after, 'nope').expenses).toHaveLength(1)
  })
})
