import { describe, it, expect } from 'vitest'
import { type Wallet, applyWalletDelta, profit } from './wallet'

const easypaisa: Wallet = { id: 'w1', name: 'Easypaisa', balance: 19510_00 }

describe('wallet math', () => {
  it('applies a negative delta (money sent out of the wallet)', () => {
    const next = applyWalletDelta(easypaisa, -5000_00)
    expect(next.balance).toBe(14510_00)
  })

  it('applies a positive delta (money received into the wallet)', () => {
    const next = applyWalletDelta(easypaisa, 5000_00)
    expect(next.balance).toBe(24510_00)
  })

  it('does not mutate the input wallet', () => {
    applyWalletDelta(easypaisa, -1000_00)
    expect(easypaisa.balance).toBe(19510_00)
  })

  it('computes profit as commission minus discount', () => {
    expect(profit(50_00, 0)).toBe(5000)
    expect(profit(50_00, 10_00)).toBe(4000)
  })
})
