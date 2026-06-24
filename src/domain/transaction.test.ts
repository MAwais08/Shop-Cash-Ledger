import { describe, it, expect } from 'vitest'
import type { AppData } from '../data/types'
import { DEFAULT_DENOMINATIONS } from './denominations'
import { emptyDrawer, totalCash } from './cash'
import {
  applyTransaction,
  deleteTransaction,
  deriveMovements,
  mergeNoteDelta,
  type TransactionInput,
} from './transaction'

function baseData(): AppData {
  return {
    settings: { shopName: 'T', pin: '1234', denominations: DEFAULT_DENOMINATIONS.map((d) => ({ ...d })), expenseCategories: [] },
    wallets: [{ id: 'jazzcash', name: 'JazzCash', balance: 100000_00 }],
    drawer: emptyDrawer(DEFAULT_DENOMINATIONS),
    transactions: [],
    cashMovements: [],
    persons: [],
    udharEntries: [],
    expenses: [],
    counts: [],
    adjustments: [],
  }
}

// A guided deposit, commission in cash: customer gives 1020 cash, shop sends 1000 from wallet.
// cash +1020, wallet -1000, profit +20.
const depositCashInput: TransactionInput = {
  id: 't1',
  createdAt: '2026-06-24T10:00:00.000Z',
  type: 'deposit',
  walletId: 'jazzcash',
  amount: 1000_00,
  commission: 20_00,
  commissionMode: 'cash',
  notesIn: { 1000: 1, 20: 1 }, // 1020
  notesOut: {},
  customerName: 'Ali',
}

describe('mergeNoteDelta', () => {
  it('adds notesIn as positive and notesOut as negative', () => {
    expect(mergeNoteDelta({ 5000: 1, 100: 2 }, { 100: 1 })).toEqual({ 5000: 1, 100: 1 })
  })
  it('drops denominations whose net is zero', () => {
    expect(mergeNoteDelta({ 100: 2 }, { 100: 2 })).toEqual({})
  })
})

describe('deriveMovements', () => {
  it('deposit / cash: cash +(amount+commission), wallet -amount', () => {
    expect(deriveMovements('deposit', 1000_00, 20_00, 'cash')).toEqual({ cashDelta: 1020_00, walletDelta: -1000_00 })
  })
  it('deposit / wallet: cash +amount, wallet -(amount-commission)', () => {
    expect(deriveMovements('deposit', 1000_00, 20_00, 'wallet')).toEqual({ cashDelta: 1000_00, walletDelta: -980_00 })
  })
  it('withdraw / cash: cash -(amount-commission), wallet +amount', () => {
    expect(deriveMovements('withdraw', 1000_00, 20_00, 'cash')).toEqual({ cashDelta: -980_00, walletDelta: 1000_00 })
  })
  it('withdraw / wallet: cash -amount, wallet +(amount+commission)', () => {
    expect(deriveMovements('withdraw', 1000_00, 20_00, 'wallet')).toEqual({ cashDelta: -1000_00, walletDelta: 1020_00 })
  })
  it('easyload and package net to zero regardless of mode', () => {
    expect(deriveMovements('easyload', 500_00, 0, 'cash')).toEqual({ cashDelta: 500_00, walletDelta: -500_00 })
    expect(deriveMovements('package', 500_00, 0, 'wallet')).toEqual({ cashDelta: 500_00, walletDelta: -500_00 })
  })
  it('every deposit/withdraw case raises worth by exactly the commission', () => {
    for (const mode of ['cash', 'wallet'] as const) {
      const dep = deriveMovements('deposit', 1000_00, 20_00, mode)
      expect(dep.cashDelta + dep.walletDelta).toBe(20_00)
      const wd = deriveMovements('withdraw', 1000_00, 20_00, mode)
      expect(wd.cashDelta + wd.walletDelta).toBe(20_00)
    }
  })
})

describe('applyTransaction (guided)', () => {
  it('applies the derived wallet and cash deltas and records the transaction', () => {
    const next = applyTransaction(baseData(), depositCashInput)
    expect(next.wallets[0].balance).toBe(99000_00) // -1000
    expect(totalCash(next.drawer)).toBe(1020_00)   // +1020
    expect(next.transactions).toHaveLength(1)
    const t = next.transactions[0]
    expect(t.type).toBe('deposit')
    expect(t.walletDelta).toBe(-1000_00)
    expect(t.cashDelta).toBe(1020_00)
    expect(t.commission).toBe(20_00)
    expect(t.commissionMode).toBe('cash')
  })

  it('writes one transaction cash movement whose delta matches the drawer (golden invariant) and carries the note', () => {
    const input = { ...depositCashInput, note: 'Ali deposit' }
    const next = applyTransaction(baseData(), input)
    expect(next.cashMovements).toHaveLength(1)
    expect(next.cashMovements[0].sourceType).toBe('transaction')
    expect(next.cashMovements[0].delta).toBe(1020_00)
    expect(next.cashMovements[0].note).toBe('Ali deposit')
    expect(totalCash(next.drawer)).toBe(next.cashMovements.reduce((s, m) => s + m.delta, 0))
  })

  it('deposit / wallet mode reconciles when notes net to +amount', () => {
    const input: TransactionInput = {
      ...depositCashInput, id: 't2', commissionMode: 'wallet', notesIn: { 1000: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.wallets[0].balance).toBe(99020_00) // -980
    expect(totalCash(next.drawer)).toBe(1000_00)
  })

  it('withdraw / cash mode: customer sends 1000 to wallet, shop gives 980 cash', () => {
    const data = baseData()
    data.drawer = { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 } // 980 available to give as change
    const input: TransactionInput = {
      id: 'w2', createdAt: '2026-06-24T10:00:00.000Z', type: 'withdraw', walletId: 'jazzcash',
      amount: 1000_00, commission: 20_00, commissionMode: 'cash',
      notesIn: {}, notesOut: { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 }, // -980
    }
    const next = applyTransaction(data, input)
    expect(next.wallets[0].balance).toBe(101000_00) // +1000
    expect(totalCash(next.drawer)).toBe(0)          // -980 from 980
    expect(next.transactions[0].cashDelta).toBe(-980_00)
  })

  it('forces commission to 0 for easyload and ignores commissionMode', () => {
    const input: TransactionInput = {
      id: 'e1', createdAt: '2026-06-24T10:00:00.000Z', type: 'easyload', walletId: 'jazzcash',
      amount: 500_00, commission: 99_00, commissionMode: 'wallet',
      notesIn: { 500: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.transactions[0].commission).toBe(0)
    expect(next.wallets[0].balance).toBe(99500_00) // -500
    expect(totalCash(next.drawer)).toBe(500_00)
  })

  it('throws CASH_MISMATCH when entered notes do not net to the derived target; state untouched', () => {
    const input: TransactionInput = { ...depositCashInput, id: 't3', notesIn: { 1000: 1 }, notesOut: {} } // 1000 ≠ 1020
    expect(() => applyTransaction(baseData(), input)).toThrow('CASH_MISMATCH')
  })

  it('still throws NEGATIVE_NOTES when change exceeds the drawer', () => {
    const input: TransactionInput = {
      id: 'w3', createdAt: '2026-06-24T10:00:00.000Z', type: 'withdraw', walletId: 'jazzcash',
      amount: 1000_00, commission: 20_00, commissionMode: 'cash',
      notesIn: {}, notesOut: { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 }, // -980 from an empty drawer
    }
    expect(() => applyTransaction(baseData(), input)).toThrow('NEGATIVE_NOTES')
  })

  it('does not mutate the input data', () => {
    const data = baseData()
    applyTransaction(data, depositCashInput)
    expect(data.transactions).toHaveLength(0)
    expect(data.wallets[0].balance).toBe(100000_00)
    expect(totalCash(data.drawer)).toBe(0)
  })
})

describe('applyTransaction (other = manual escape hatch)', () => {
  it('uses the supplied walletDelta and notes with no derivation or mismatch check', () => {
    const input: TransactionInput = {
      id: 'o1', createdAt: '2026-06-24T10:00:00.000Z', type: 'other', walletId: null, walletDelta: 0,
      amount: 1000_00, commission: 0, commissionMode: 'cash',
      notesIn: { 1000: 1 }, notesOut: {},
    }
    const next = applyTransaction(baseData(), input)
    expect(next.wallets[0].balance).toBe(100000_00) // untouched
    expect(totalCash(next.drawer)).toBe(1000_00)
    expect(next.transactions[0].cashDelta).toBe(1000_00)
  })
})

describe('deleteTransaction', () => {
  it('reverses a derived deposit exactly', () => {
    const after = applyTransaction(baseData(), depositCashInput)
    const reverted = deleteTransaction(after, 't1')
    expect(reverted.transactions).toHaveLength(0)
    expect(reverted.cashMovements).toHaveLength(0)
    expect(reverted.wallets[0].balance).toBe(100000_00)
    expect(totalCash(reverted.drawer)).toBe(0)
  })

  it('reverses a derived withdraw exactly', () => {
    const data = baseData()
    data.drawer = { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 } // 980
    const input: TransactionInput = {
      id: 'w9', createdAt: '2026-06-24T10:00:00.000Z', type: 'withdraw', walletId: 'jazzcash',
      amount: 1000_00, commission: 20_00, commissionMode: 'cash',
      notesIn: {}, notesOut: { 500: 1, 100: 4, 50: 1, 20: 1, 10: 1 },
    }
    const after = applyTransaction(data, input)
    const reverted = deleteTransaction(after, 'w9')
    expect(reverted.wallets[0].balance).toBe(100000_00)
    expect(totalCash(reverted.drawer)).toBe(980_00)
    expect(reverted.transactions).toHaveLength(0)
  })

  it('returns data unchanged when the id is unknown', () => {
    const after = applyTransaction(baseData(), depositCashInput)
    expect(deleteTransaction(after, 'nope').transactions).toHaveLength(1)
  })
})
