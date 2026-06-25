import type { ComponentType } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Banknote,
  Receipt,
  Users,
  Calculator,
  Scale,
  Settings,
  Lock,
  X,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

interface NavSection {
  heading: string
  items: NavItem[]
}

const sections: NavSection[] = [

  {
    heading: 'Main',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
      { label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
      { label: 'Cash & Notes', to: '/cash', icon: Banknote },
    ],
  },
  {
    heading: 'Records',
    items: [
      { label: 'Expenses', to: '/kharcha', icon: Receipt },
      { label: 'Credit Ledger', to: '/udhari', icon: Users },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { label: 'Count Cash', to: '/count', icon: Calculator },
      { label: 'Capital Adjustment', to: '/adjustment', icon: Scale },
    ],
  },
]

function NavItemLink({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'border-l-[3px] border-emerald-500 bg-slate-800 font-semibold text-emerald-400'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function AppSidebar() {
  const { open, close } = useSidebar()
  const navigate = useNavigate()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-slate-900 transition-transform duration-200
          md:static md:translate-x-0 md:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Sidebar"
      >
        {/* Logo row */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
              P
            </div>
            <span className="text-base font-bold tracking-tight text-emerald-400">PCO Shop</span>
          </div>
          <button
            onClick={close}
            className="rounded p-1 text-slate-400 hover:text-slate-100 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {section.heading}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItemLink key={item.to} item={item} onClick={close} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-0.5 border-t border-slate-800 px-2 py-2">
          <NavLink
            to="/settings"
            onClick={close}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'border-l-[3px] border-emerald-500 bg-slate-800 font-semibold text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={() => { close(); navigate('/settings') }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-400 hover:bg-slate-800"
          >
            <Lock className="h-4 w-4 shrink-0" />
            <span>Lock</span>
          </button>
        </div>
      </aside>
    </>
  )
}
