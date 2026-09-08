import { Route, Routes } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import UserDashboard from './user/UserDashboard'
import MyRoutesPage from './routes/MyRoutesPage'
import HistoryPage from './user/HistoryPage'
import AllTerritoriesPage from './user/AllTerritoriesPage'

export default function UserPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<UserDashboard />} />
          <Route path="territories" element={<AllTerritoriesPage />} />
          <Route path="route" element={<MyRoutesPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  )
}
