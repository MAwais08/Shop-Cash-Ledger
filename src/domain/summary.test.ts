import { describe, it, expect } from 'vitest'
import type { Transaction } from './transaction'
import {
  summarize, isSameDay, todaysTransactions, searchTransactions, walletStats,
} from './summary'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 'x', type: 'send', walletId: 'jazzcash', walletDelta: 0, amount: 0,
    commission: 0, discount: 0, cashDelta: 0, createdAt: '2026-06-22T10:00:00.000Z', ...p,
  }
}

describe('summarize', () => {
  it('totals counts, sent, received, commission, discount and profit', () => {
    const s = summarize([
      tx({ type: 'send', amount: 5000_00, commission: 50_00, discount: 0 }),
      tx({ type: 'receive', amount: 2000_00, commission: 20_00, discount: 5_00 }),
      tx({ type: 'easyload', amount: 100_00, commission: 3_00, discount: 0 }),
    ])
    expect(s.count).toBe(3)
    expect(s.sent).toBe(5000_00)
    expect(s.received).toBe(2000_00)
    expect(s.commission).toBe(73_00)
    expect(s.discount).toBe(5_00)
    expect(s.profit).toBe(68_00) // 73 - 5
  })
})

describe('isSameDay / todaysTransactions', () => {
  it('matches transactions on the same calendar day', () => {
    const ref = new Date('2026-06-22T23:00:00.000Z')
    expect(isSameDay('2026-06-22T01:00:00.000Z', ref)).toBe(true)
    expect(isSameDay('2026-06-21T23:00:00.000Z', ref)).toBe(false)
  })

  it('filters to todays transactions', () => {
    const ref = new Date('2026-06-22T12:00:00.000Z')
    const list = [
      tx({ id: 'a', createdAt: '2026-06-22T09:00:00.000Z' }),
      tx({ id: 'b', createdAt: '2026-06-20T09:00:00.000Z' }),
    ]
    expect(todaysTransactions(list, ref).map((t) => t.id)).toEqual(['a'])
  })
})

describe('searchTransactions', () => {
  const list = [
    tx({ id: 'a', customerName: 'Ali Khan', customerPhone: '03001234567' }),
    tx({ id: 'b', customerName: 'Bilal', note: 'easyload zong' }),
  ]
  it('returns all on blank query', () => {
    expect(searchTransactions(list, '   ')).toHaveLength(2)
  })
  it('matches name, phone, and note case-insensitively', () => {
    expect(searchTransactions(list, 'ali').map((t) => t.id)).toEqual(['a'])
    expect(searchTransactions(list, '0300').map((t) => t.id)).toEqual(['a'])
    expect(searchTransactions(list, 'ZONG').map((t) => t.id)).toEqual(['b'])
  })
})

describe('walletStats', () => {
  it('sums sent/received/commission/discount for one wallet', () => {
    const list = [
      tx({ walletId: 'jazzcash', type: 'send', amount: 5000_00, commission: 50_00 }),
      tx({ walletId: 'jazzcash', type: 'receive', amount: 2000_00, discount: 10_00 }),
      tx({ walletId: 'easypaisa', type: 'send', amount: 999_00, commission: 9_00 }),
    ]
    const s = walletStats(list, 'jazzcash')
    expect(s.sent).toBe(5000_00)
    expect(s.received).toBe(2000_00)
    expect(s.commission).toBe(50_00)
    expect(s.discount).toBe(10_00)
  })
})
