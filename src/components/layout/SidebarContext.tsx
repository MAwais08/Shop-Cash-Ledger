import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface SidebarCtx {
  open: boolean
  toggle: () => void
  close: () => void
}

const SidebarContext = createContext<SidebarCtx | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <SidebarContext.Provider
      value={{ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside SidebarProvider')
  return ctx
}
