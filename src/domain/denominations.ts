export interface Denomination {
  value: number // whole-rupee note/coin value
  isBig: boolean
}

/** Default Pakistani note set, highest to lowest. Big = 500/1000/5000. */
export const DEFAULT_DENOMINATIONS: Denomination[] = [
  { value: 5000, isBig: true },
  { value: 1000, isBig: true },
  { value: 500, isBig: true },
  { value: 100, isBig: false },
  { value: 50, isBig: false },
  { value: 20, isBig: false },
  { value: 10, isBig: false },
  { value: 5, isBig: false },
  { value: 2, isBig: false },
  { value: 1, isBig: false },
]

export function isBigValue(value: number, denoms: Denomination[]): boolean {
  const match = denoms.find((d) => d.value === value)
  return match ? match.isBig : false
}
