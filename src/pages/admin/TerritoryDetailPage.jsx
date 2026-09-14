import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import AddressMap from '../../components/shared/AddressMap'

const STATUS_PILL = {
  available: 'pill-available',
  active: 'pill-active',
  completed: 'pill-complete',
}

const CALL_STATUS_LABEL = {
  H: 'Home',
  NH: 'Not Home',
  NLH: 'Do Not Call',
}

const CALL_STATUS_COLOR = {
  H: '#10b981',
  NH: '#f59e0b',
  NLH: '#ef4444',
}
const NOT_VISITED_COLOR = '#94a3b8'

export default function TerritoryDetailPage() {
  const { territoryId } = useParams()
  const [territory, setTerritory] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [userNames, setUserNames] = useState({})
  const [callRecords, setCallRecords] = useState([])

  useEffect(
    () => onSnapshot(doc(db, 'territories', territoryId), (snap) => setTerritory(snap.exists() ? { id: snap.id, ...snap.data() } : null)),
    [territoryId],
  )

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'addresses'), where('territory_id', '==', territoryId)), (snap) =>
        setAddresses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [territoryId],
  )

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'territory_assignments'), where('territory_id', '==', territoryId)), (snap) =>
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [territoryId],
  )

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'call_records'), where('territory_id', '==', territoryId)), (snap) =>
        setCallRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [territoryId],
  )

  useEffect(() => {
    const userIds = [...new Set(assignments.map((a) => a.user_id))]
    if (userIds.length === 0) return
    const unsubs = userIds.map((uid) =>
      onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) setUserNames((prev) => ({ ...prev, [uid]: snap.data().name }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [assignments])

  const latestCallByAddress = useMemo(() => {
    const map = new Map()
    for (const record of callRecords) {
      const existing = map.get(record.address_id)
      const recordedAtMs = record.recorded_at?.toMillis?.() ?? 0
      if (!existing || recordedAtMs > (existing.recorded_at?.toMillis?.() ?? 0)) {
        map.set(record.address_id, record)
      }
    }
    return map
  }, [callRecords])

  const doorsCalled = latestCallByAddress.size
  const progressPct = addresses.length > 0 ? Math.round((doorsCalled / addresses.length) * 100) : 0

  if (!territory) {
    return <div className="p-6 md:p-8 text-slate-400 dark:text-slate-500">Loading territory…</div>
  }

  return (
    <div className="p-6 md:p-8">
      <Link to="/admin" className="mb-4 inline-block text-sm text-brand hover:underline">← Back to territories</Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Map {territory.map_number}{territory.map_sub} — {territory.suburb}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{addresses.length} addresses</p>
        </div>
        <span className={STATUS_PILL[territory.status] || 'pill-available'}>{territory.status}</span>
      </div>

      <div className="card mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Map</h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NOT_VISITED_COLOR }} />Not visited</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CALL_STATUS_COLOR.H }} />Home</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CALL_STATUS_COLOR.NH }} />Not Home</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CALL_STATUS_COLOR.NLH }} />Do Not Call</span>
          </div>
        </div>
        <AddressMap
          addresses={addresses}
          getColor={(a) => CALL_STATUS_COLOR[latestCallByAddress.get(a.id)?.status] || NOT_VISITED_COLOR}
          getPopupText={(a) => {
            const call = latestCallByAddress.get(a.id)
            const label = call ? CALL_STATUS_LABEL[call.status] || call.status : 'Not visited'
            return `${a.street_number} ${a.unit ? `Unit ${a.unit} ` : ''}${a.street_name} — ${label}`
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Addresses</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">{doorsCalled} / {addresses.length} called ({progressPct}%)</span>
          </div>
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className="h-full bg-brand transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-1 pr-4">Address</th>
                  <th className="py-1 pr-4">Mother tongue</th>
                  <th className="py-1 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {addresses.map((a) => {
                  const call = latestCallByAddress.get(a.id)
                  return (
                    <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">
                        {a.street_number} {a.unit && `Unit ${a.unit}`} {a.street_name}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-500 dark:text-slate-400">{a.mother_tongue || '—'}</td>
                      <td className="py-1.5 pr-4">
                        {call ? (
                          <span className="pill-complete">{CALL_STATUS_LABEL[call.status] || call.status}</span>
                        ) : (
                          <span className="pill-available">Not visited</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Assigned publishers</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Not assigned to anyone yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {assignments.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{userNames[a.user_id] || a.user_id}</span>
                    <span className={STATUS_PILL[a.status] || 'pill-available'}>{a.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
