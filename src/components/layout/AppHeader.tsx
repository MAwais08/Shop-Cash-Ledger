import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, ChevronRight } from 'lucide-react'
import { useSidebar } from './SidebarContext'

const LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/new': 'New Transaction',
  '/transactions': 'Transactions',
  '/cash': 'Cash & Notes',
  '/settings': 'Settings',
  '/kharcha': 'Expenses',
  '/udhari': 'Credit Ledger',
  '/count': 'Count Cash',
  '/adjustment': 'Capital Adjustment',
}

function getPageLabel(pathname: string): string {
  if (LABELS[pathname]) return LABELS[pathname]
  if (pathname.startsWith('/udhari/')) return 'Person Detail'
  return 'PCO Shop'
}

export default function AppHeader() {
  const { toggle } = useSidebar()
  const location = useLocation()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const label = getPageLabel(location.pathname)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={toggle}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          <span className="shrink-0 text-slate-400">Home</span>
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate font-semibold text-slate-900">{label}</span>
        </nav>
      </div>

      <time
        className="shrink-0 text-xs font-medium tabular-nums text-slate-400"
        dateTime={time.toISOString()}
      >
        {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </time>
    </header>
  )
}
