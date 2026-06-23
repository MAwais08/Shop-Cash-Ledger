export function todayLabel(d: Date = new Date()): string {
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}
