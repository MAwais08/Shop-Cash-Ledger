/** All stored money is integer paisa (rupees * 100). */
export type Paisa = number

export function toPaisa(rupees: number): Paisa {
  return Math.round(rupees * 100)
}

export function toRupees(paisa: Paisa): number {
  return paisa / 100
}

/** Formats paisa as "Rs 1,234" (whole) or "Rs 1,234.50" (with paisa). */
export function formatPKR(paisa: Paisa): string {
  const rupees = paisa / 100
  const hasFraction = paisa % 100 !== 0
  const formatted = rupees.toLocaleString('en-PK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `Rs ${formatted}`
}
