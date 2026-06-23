import { useState } from 'react'
import { useAppStore } from '../store/appStore'

export default function Login() {
  const login = useAppStore((s) => s.login)
  const shopName = useAppStore((s) => s.data?.settings.shopName ?? 'My PCO Shop')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!login(pin)) {
      setError('Galat PIN. Dobara koshish karein.')
      setPin('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow"
      >
        <h1 className="mb-1 text-center text-2xl font-bold">{shopName}</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Shop Account Management</p>
        <label htmlFor="pin" className="mb-1 block text-sm font-medium">
          PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest"
          autoFocus
        />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white"
        >
          Login
        </button>
      </form>
    </div>
  )
}
