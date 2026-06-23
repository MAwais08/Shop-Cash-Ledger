import { describe, it, expect } from 'vitest'
import { DEFAULT_DENOMINATIONS, isBigValue } from './denominations'

describe('denominations', () => {
  it('lists all default notes from highest to lowest', () => {
    const values = DEFAULT_DENOMINATIONS.map((d) => d.value)
    expect(values).toEqual([5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1])
  })

  it('classifies 500/1000/5000 as big notes', () => {
    expect(isBigValue(5000, DEFAULT_DENOMINATIONS)).toBe(true)
    expect(isBigValue(1000, DEFAULT_DENOMINATIONS)).toBe(true)
    expect(isBigValue(500, DEFAULT_DENOMINATIONS)).toBe(true)
  })

  it('classifies 100 and below as small notes', () => {
    expect(isBigValue(100, DEFAULT_DENOMINATIONS)).toBe(false)
    expect(isBigValue(10, DEFAULT_DENOMINATIONS)).toBe(false)
    expect(isBigValue(1, DEFAULT_DENOMINATIONS)).toBe(false)
  })

  it('returns false for an unknown value', () => {
    expect(isBigValue(7, DEFAULT_DENOMINATIONS)).toBe(false)
  })
})
