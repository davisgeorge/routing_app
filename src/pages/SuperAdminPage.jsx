import { Route, Routes } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import SuperAdminOverview from './superadmin/SuperAdminOverview'
import ImportPage from './superadmin/ImportPage'
import GroupDetailPage from './superadmin/GroupDetailPage'
import MyRoutesPage from './routes/MyRoutesPage'

export default function SuperAdminPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<SuperAdminOverview />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="groups/:groupId" element={<GroupDetailPage />} />
          <Route path="route" element={<MyRoutesPage />} />
        </Routes>
      </main>
    </div>
  )
}
