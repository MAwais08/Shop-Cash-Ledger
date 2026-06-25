import { Outlet } from 'react-router-dom'
import { SidebarProvider } from './layout/SidebarContext'
import AppSidebar from './layout/AppSidebar'
import AppHeader from './layout/AppHeader'

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6" aria-label="Content">
            <div className="mx-auto max-w-4xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
