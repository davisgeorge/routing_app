import { Route, Routes } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import AdminOverview from './admin/AdminOverview'
import TerritoryDetailPage from './admin/TerritoryDetailPage'
import MembersPage from './admin/MembersPage'
import ReportsPage from './admin/ReportsPage'
import MyRoutesPage from './routes/MyRoutesPage'

export default function AdminPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="territories/:territoryId" element={<TerritoryDetailPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="route" element={<MyRoutesPage />} />
        </Routes>
      </main>
    </div>
  )
}
