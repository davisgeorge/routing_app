import { useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const CALL_STATUS_LABEL = { H: 'Home', NH: 'Not Home', NLH: 'No Longer Hindi' }

function formatDate(timestamp) {
  const date = timestamp?.toDate?.()
  return date ? date.toLocaleDateString() : '—'
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [completedAssignments, setCompletedAssignments] = useState([])
  const [territories, setTerritories] = useState({})
  const [completedRoutes, setCompletedRoutes] = useState([])
  const [recentCalls, setRecentCalls] = useState([])

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'territory_assignments'), where('user_id', '==', user.uid), where('status', '==', 'completed')),
      (snap) => setCompletedAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [user])

  useEffect(() => {
    const unsubs = completedAssignments.map((a) =>
      onSnapshot(doc(db, 'territories', a.territory_id), (snap) => {
        if (snap.exists()) setTerritories((prev) => ({ ...prev, [a.territory_id]: snap.data() }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [completedAssignments])

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'personal_routes'), where('user_id', '==', user.uid), where('status', '==', 'completed')),
      (snap) => setCompletedRoutes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'call_records'), where('recorded_by', '==', user.uid), orderBy('recorded_at', 'desc'), limit(50)),
      (snap) => setRecentCalls(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [user])

  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">History</h1>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Completed territories</h2>
          {completedAssignments.length === 0 ? (
            <p className="text-sm text-slate-400">None yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {completedAssignments.map((a) => {
                const t = territories[a.territory_id]
                return (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700">{t ? `Map ${t.map_number}${t.map_sub} — ${t.suburb}` : a.territory_id}</span>
                    <span className="text-xs text-slate-400">{formatDate(a.completed_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Completed personal routes</h2>
          {completedRoutes.length === 0 ? (
            <p className="text-sm text-slate-400">None yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {completedRoutes.map((r) => (
                <li key={r.id} className="py-2 text-sm text-slate-700">
                  {r.name || 'Untitled route'} · {r.address_ids?.length || 0} stops
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent doors</h2>
        {recentCalls.length === 0 ? (
          <p className="text-sm text-slate-400">No doors recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentCalls.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">{CALL_STATUS_LABEL[c.status] || c.status}</span>
                <span className="text-xs text-slate-400">{formatDate(c.recorded_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
