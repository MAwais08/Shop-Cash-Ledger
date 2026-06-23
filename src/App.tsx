import { Routes, Route } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import NewTransaction from './pages/NewTransaction'
import Transactions from './pages/Transactions'
import Cash from './pages/Cash'
import Settings from './pages/Settings'
import Kharcha from './pages/Kharcha'

export default function App() {
  const authed = useAppStore((s) => s.authed)
  const data = useAppStore((s) => s.data)

  if (!data) return <div className="p-8 text-center">Loading…</div>
  if (!authed) return <Login />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewTransaction />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="cash" element={<Cash />} />
        <Route path="settings" element={<Settings />} />
        <Route path="kharcha" element={<Kharcha />} />
      </Route>
    </Routes>
  )
}
