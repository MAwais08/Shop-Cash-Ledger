import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { Denomination } from '../domain/denominations'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `w-${Date.now()}`
}

function uniqueWalletId(base: string, wallets: { id: string }[]): string {
  let id = base
  let n = 2
  while (wallets.some((w) => w.id === id)) {
    id = `${base}-${n}`
    n++
  }
  return id
}

export default function Settings() {
  const data = useAppStore((s) => s.data)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const upsertWallet = useAppStore((s) => s.upsertWallet)
  const removeWallet = useAppStore((s) => s.removeWallet)
  const logout = useAppStore((s) => s.logout)

  const [shopName, setShopName] = useState(data?.settings.shopName ?? '')
  const [pin, setPin] = useState(data?.settings.pin ?? '')
  const [newWallet, setNewWallet] = useState('')
  const [newCategory, setNewCategory] = useState('')

  if (!data) return null

  const safeData = data

  function toggleBig(d: Denomination) {
    const denominations = safeData.settings.denominations.map((x) =>
      x.value === d.value ? { ...x, isBig: !x.isBig } : x,
    )
    updateSettings({ denominations })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Shop</h2>
        <label htmlFor="shopName" className="block text-sm">Shop name</label>
        <input
          id="shopName"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <label htmlFor="pin" className="block text-sm">Login PIN</label>
        <input
          id="pin"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          inputMode="numeric"
        />
        <button
          onClick={() => updateSettings({ shopName, pin })}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          Save shop
        </button>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Wallets</h2>
        <ul className="space-y-1">
          {data.wallets.map((w) => (
            <li key={w.id} className="flex items-center justify-between">
              <span>{w.name}</span>
              <button
                onClick={() => removeWallet(w.id)}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor="newWallet" className="block text-sm">New wallet name</label>
        <div className="flex gap-2">
          <input
            id="newWallet"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <button
            onClick={() => {
              if (!newWallet.trim()) return
              upsertWallet({ id: uniqueWalletId(slugify(newWallet), data.wallets), name: newWallet.trim(), balance: 0 })
              setNewWallet('')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"
          >
            Add wallet
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Expense Categories</h2>
        <ul className="space-y-1">
          {data.settings.expenseCategories.map((c) => (
            <li key={c} className="flex items-center justify-between">
              <span>{c}</span>
              <button
                onClick={() => updateSettings({ expenseCategories: safeData.settings.expenseCategories.filter((x) => x !== c) })}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor="newCategory" className="block text-sm">New category</label>
        <div className="flex gap-2">
          <input id="newCategory" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 rounded-lg border px-3 py-2" />
          <button
            onClick={() => {
              const name = newCategory.trim()
              if (!name || safeData.settings.expenseCategories.includes(name)) return
              updateSettings({ expenseCategories: [...safeData.settings.expenseCategories, name] })
              setNewCategory('')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"
          >
            Add category
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Notes — Big / Small</h2>
        <ul className="grid grid-cols-2 gap-2">
          {data.settings.denominations.map((d) => (
            <li key={d.value} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>Rs {d.value}</span>
              <button
                onClick={() => toggleBig(d)}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  d.isBig ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {d.isBig ? 'Big' : 'Small'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button onClick={logout} className="w-full rounded-lg bg-slate-200 py-3 font-semibold">
        Logout
      </button>
    </div>
  )
}
