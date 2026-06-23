import type { Denomination } from '../domain/denominations'
import { formatPKR } from '../domain/money'

interface NotePickerProps {
  label: string
  denominations: Denomination[]
  counts: Record<number, number>
  onChange: (counts: Record<number, number>) => void
}

export default function NotePicker({ label, denominations, counts, onChange }: NotePickerProps) {
  const total = denominations.reduce((sum, d) => sum + d.value * (counts[d.value] ?? 0), 0) * 100

  function setCount(value: number, next: number) {
    if (next < 0) return
    onChange({ ...counts, [value]: next })
  }

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className="font-bold">{formatPKR(total)}</span>
      </div>
      <ul className="space-y-1">
        {denominations.map((d) => {
          const count = counts[d.value] ?? 0
          return (
            <li key={d.value} className="flex items-center gap-2">
              <span className="w-16 text-sm text-slate-500">Rs {d.value}</span>
              <button
                type="button"
                aria-label={`remove Rs ${d.value}`}
                onClick={() => setCount(d.value, count - 1)}
                className="h-8 w-8 rounded-lg bg-slate-100 text-lg font-bold"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold">{count}</span>
              <button
                type="button"
                aria-label={`add Rs ${d.value}`}
                onClick={() => setCount(d.value, count + 1)}
                className="h-8 w-8 rounded-lg bg-emerald-100 text-lg font-bold text-emerald-700"
              >
                +
              </button>
              <span className="ml-auto text-sm text-slate-400">
                {count > 0 ? formatPKR(d.value * count * 100) : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
