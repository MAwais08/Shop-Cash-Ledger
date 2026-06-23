import { describe, it, expect } from 'vitest'
import { toPaisa, toRupees, formatPKR } from './money'

describe('money', () => {
  it('converts rupees to integer paisa', () => {
    expect(toPaisa(1)).toBe(100)
    expect(toPaisa(50.5)).toBe(5050)
    expect(toPaisa(706883.39)).toBe(70688339)
  })

  it('converts paisa back to rupees', () => {
    expect(toRupees(100)).toBe(1)
    expect(toRupees(5050)).toBe(50.5)
  })

  it('formats paisa as PKR with thousands separators', () => {
    expect(formatPKR(0)).toBe('Rs 0')
    expect(formatPKR(135612_00)).toBe('Rs 135,612')
    expect(formatPKR(5050)).toBe('Rs 50.50')
  })
})
