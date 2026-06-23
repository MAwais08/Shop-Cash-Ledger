import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Home', end: true },
  { to: '/transactions', label: 'Txns', end: false },
  { to: '/cash', label: 'Cash', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <main className="flex-1 p-4 pb-24" aria-label="Content">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-3xl border-t bg-white" aria-label="Main">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm ${
                isActive ? 'font-semibold text-emerald-600' : 'text-slate-500'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
