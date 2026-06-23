import { Link } from 'react-router-dom'
import { useAppStore, selectTotalCash, selectBigTotal, selectSmallTotal } from '../store/appStore'
import { formatPKR } from '../domain/money'
import { isBigValue } from '../domain/denominations'

export default function Cash() {
  const data = useAppStore((s) => s.data)
  const total = useAppStore(selectTotalCash)
  const big = useAppStore(selectBigTotal)
  const small = useAppStore(selectSmallTotal)
  if (!data) return null

  const { denominations } = data.settings

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Cash &amp; Notes</h1>

      <Link to="/count" className="block rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
        Count &amp; Verify
      </Link>

      <Link to="/adjustment" className="block rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
        Add / Remove Money
      </Link>

      <section className="rounded-2xl bg-emerald-600 p-4 text-white">
        <div className="text-sm opacity-90">Total Cash</div>
        <div className="text-3xl font-extrabold">{formatPKR(total)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Bare Note (Big)</div>
            <div className="font-bold">{formatPKR(big)}</div>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <div className="text-xs opacity-90">Chote Note (Small)</div>
            <div className="font-bold">{formatPKR(small)}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Notes</h2>
        <ul className="space-y-1">
          {denominations.map((d) => {
            const count = data.drawer[d.value] ?? 0
            const big = isBigValue(d.value, denominations)
            return (
              <li key={d.value} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className="w-16">Rs {d.value}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${big ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {big ? 'Big' : 'Small'}
                  </span>
                </span>
                <span className="text-slate-500">× {count}</span>
                <span className="w-28 text-right font-semibold">{formatPKR(d.value * count * 100)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Recent cash movements</h2>
        {data.cashMovements.length === 0 && <p className="text-sm text-slate-500">No cash movements yet.</p>}
        <ul className="space-y-1">
          {data.cashMovements.slice(0, 20).map((m) => (
            <li key={m.id} className="flex justify-between rounded-lg border bg-white px-3 py-2 text-sm">
              <span className={m.delta >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                {m.delta >= 0 ? '+' : ''}{formatPKR(m.delta)}
              </span>
              <span className="text-slate-400">{m.sourceType}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
