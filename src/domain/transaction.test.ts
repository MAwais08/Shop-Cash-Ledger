import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import { applyTransaction, deleteTransaction, mergeNoteDelta, type TransactionInput } from './transaction'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })) },
    wallets: [{ id: 'jazzcash', name: 'JazzCash', balance: 100000_00 }],
    drawer: emptyDrawer(DEFAULT_DENOMINATIONS),
    transactions: [],
    cashMovements: [],
  }
}

const sendInput: TransactionInput = {
  id: 't1',
  createdAt: '2026-06-22T10:00:00.000Z',
  type: 'send',
  walletId: 'jazzcash',
  walletDelta: -5000_00, // money out of wallet
  amount: 5000_00,
  commission: 50_00,
  discount: 0,
  notesIn: { 5000: 1, 50: 1 }, // customer pays 5050 in cash
  notesOut: {}, // no change
  customerName: 'Ali',
  customerPhone: '03001234567',
}

describe('mergeNoteDelta', () => {
  it('adds notesIn as positive and notesOut as negative', () => {
    expect(mergeNoteDelta({ 5000: 1, 100: 2 }, { 100: 1 })).toEqual({ 5000: 1, 100: 1 })
  })

  it('drops denominations whose net is zero', () => {
    expect(mergeNoteDelta({ 100: 2 }, { 100: 2 })).toEqual({})
    expect(mergeNoteDelta({ 5000: 1, 100: 2 }, { 100: 2 })).toEqual({ 5000: 1 })
  })
})

describe('applyTransaction', () => {
  it('decreases the wallet by walletDelta', () => {
    const next = applyTransaction(baseData(), sendInput)
    expect(next.wallets[0].balance).toBe(95000_00)
  })

  it('increases the drawer by the net notes and records the right cash total', () => {
    const next = applyTransaction(baseData(), sendInput)
    expect(next.drawer[5000]).toBe(1)
    expect(next.drawer[50]).toBe(1)
    expect(totalCash(next.drawer)).toBe(5050_00)
  })

  it('appends the transaction with computed cashDelta', () => {
    const next = applyTransaction(baseData(), sendInput)
    expect(next.transactions).toHaveLength(1)
    const t = next.transactions[0]
    expect(t.id).toBe('t1')
    expect(t.cashDelta).toBe(5050_00)
    expect(t.commission).toBe(5000)
  })

  it('appends a cash movement matching the drawer change (golden invariant)', () => {
    const next = applyTransaction(baseData(), sendInput)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].delta).toBe(5050_00)
    expect(next.cashMovements[0].sourceId).toBe('t1')
    const ledgerSum = next.cashMovements.reduce((s, m) => s + m.delta, 0)
    expect(totalCash(next.drawer)).toBe(ledgerSum)
  })

  it('handles change given out (notesOut reduces the drawer and cashDelta)', () => {
    const data = baseData()
    data.drawer = { ...emptyDrawer(DEFAULT_DENOMINATIONS), 100: 10 } // 1000 in drawer
    const input: TransactionInput = {
      ...sendInput, id: 't2', notesIn: { 5000: 1 }, notesOut: { 100: 5 }, // +5000 -500 = +4500
    }
    const next = applyTransaction(data, input)
    expect(next.transactions[0].cashDelta).toBe(4500_00)
    expect(next.drawer[5000]).toBe(1)
    expect(next.drawer[100]).toBe(5)
    expect(totalCash(next.drawer)).toBe(5500_00)
  })

  it('supports cash-only transactions (walletId null, no wallet change)', () => {
    const input: TransactionInput = {
      ...sendInput, id: 't3', walletId: null, walletDelta: 0, type: 'other', notesIn: { 1000: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.wallets[0].balance).toBe(100000_00) // unchanged
    expect(totalCash(next.drawer)).toBe(1000_00)
  })

  it('throws NEGATIVE_NOTES when change exceeds the drawer', () => {
    const input: TransactionInput = { ...sendInput, id: 't4', notesIn: {}, notesOut: { 100: 1 } }
    expect(() => applyTransaction(baseData(), input)).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyTransaction(data, sendInput)
    expect(data.transactions).toHaveLength(0)
    expect(data.wallets[0].balance).toBe(100000_00)
    expect(totalCash(data.drawer)).toBe(0)
  })
})

describe('deleteTransaction', () => {
  it('reverses the wallet and drawer effects and removes the records', () => {
    const after = applyTransaction(baseData(), sendInput)
    const reverted = deleteTransaction(after, 't1')
    expect(reverted.transactions).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.wallets[0].balance).toBe(100000_00)
    expect(totalCash(reverted.drawer)).toBe(0)
  })

  it('returns data unchanged when the id is unknown', () => {
    const after = applyTransaction(baseData(), sendInput)
    const same = deleteTransaction(after, 'nope')
    expect(same.transactions).toHaveLength(1)
  })

  it('throws NEGATIVE_NOTES if the notes to reverse are no longer in the drawer', () => {
    const after = applyTransaction(baseData(), sendInput) // drawer now has 5000x1, 50x1
    const spent = applyTransaction(after, {
      ...sendInput, id: 't9', walletId: null, walletDelta: 0, notesIn: {}, notesOut: { 5000: 1 },
    })
    expect(() => deleteTransaction(spent, 't1')).toThrow('NEGATIVE_NOTES')
  })
})
