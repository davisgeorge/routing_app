import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Spinner from './components/shared/Spinner'
import OfflineBanner from './components/shared/OfflineBanner'
import LoginPage from './pages/LoginPage'
import InvitePage from './pages/InvitePage'
import SuperAdminPage from './pages/SuperAdminPage'
import AdminPage from './pages/AdminPage'
import UserPage from './pages/UserPage'

const HOME_BY_ROLE = {
  super_admin: '/super-admin',
  admin: '/admin',
  user: '/user',
}

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner label="Loading…" />
    </div>
  )
}

// Signed in, but no matching users/{uid} Firestore doc — e.g. a brand-new
// invite/join-request account waiting on admin approval, or (for the very
// first account) the super_admin doc hasn't been created yet. Without this,
// the app used to spin forever with no explanation once `loading` settled.
function NoProfileScreen() {
  const { logout } = useAuth()
  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="card max-w-sm text-center">
        <h1 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">No profile found</h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Your account is signed in but isn't set up in TerritoryMap yet. If you just requested to join a group,
          wait for an admin to approve you. 
        </p>
        <button type="button" className="btn-ghost w-full" onClick={logout}>Sign out</button>
      </div>
    </div>
  )
}

function RequireRole({ role, children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!profile) return <NoProfileScreen />
  if (profile.role !== role) return <Navigate to={HOME_BY_ROLE[profile.role] || '/login'} replace />

  return children
}

function HomeRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <NoProfileScreen />

  return <Navigate to={HOME_BY_ROLE[profile.role] || '/login'} replace />
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/super-admin/*"
          element={
            <RequireRole role="super_admin">
              <SuperAdminPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireRole role="admin">
              <AdminPage />
            </RequireRole>
          }
        />
        <Route
          path="/user/*"
          element={
            <RequireRole role="user">
              <UserPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
