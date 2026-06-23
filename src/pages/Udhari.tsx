import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { formatPKR } from '../domain/money'
import { personBalance, udharTotals } from '../domain/udhar'

export default function Udhari() {
  const data = useAppStore((s) => s.data)
  const addPerson = useAppStore((s) => s.addPerson)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const totals = useMemo(
    () => udharTotals(data?.udharEntries ?? [], data?.persons ?? []),
    [data],
  )

  if (!data) return <div className="p-8">Loading…</div>

  const persons = data.persons
  const entries = data.udharEntries

  const handleAdd = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await addPerson(name.trim(), phone.trim() || undefined)
      setName('')
      setPhone('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Udhari</h1>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">Receivable (lena)</div>
          <div className="text-lg font-bold text-emerald-600">{formatPKR(totals.receivable)}</div>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">Payable (dena)</div>
          <div className="text-lg font-bold text-red-600">{formatPKR(totals.payable)}</div>
        </div>
      </div>

      <section className="space-y-2 rounded-xl border bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-600">Add person</h2>
        <label htmlFor="name" className="block text-sm">Name</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <label htmlFor="phone" className="block text-sm">Phone (optional)</label>
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          inputMode="tel"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"
        >
          Add person
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">People</h2>
        <ul className="space-y-1">
          {persons.map((p) => {
            const bal = personBalance(entries, p.id)
            return (
              <li key={p.id}>
                <Link
                  to={`/udhari/${p.id}`}
                  className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
                >
                  <span>{p.name}</span>
                  <span
                    className={`font-semibold ${bal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {bal >= 0 ? '' : '-'}{formatPKR(Math.abs(bal))}
                  </span>
                </Link>
              </li>
            )
          })}
          {persons.length === 0 && (
            <li className="text-sm text-slate-400">No people yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
