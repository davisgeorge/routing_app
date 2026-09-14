import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const IN_CHUNK_SIZE = 30

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Firestore denies an entire query if any doc in the potential result set
// could fail its rule, so we scope call_records/territory_assignments to
// this group's own territory_ids (chunked, since 'in' caps at 30) rather
// than querying the collections unconstrained.
async function fetchByTerritoryIdChunks(collectionName, territoryIds, extraWhere) {
  const results = await Promise.all(
    chunk(territoryIds, IN_CHUNK_SIZE).map((ids) => {
      const clauses = [where('territory_id', 'in', ids)]
      if (extraWhere) clauses.push(extraWhere)
      return getDocs(query(collection(db, collectionName), ...clauses))
    }),
  )
  return results.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
}

function monthKey(timestamp) {
  const date = timestamp?.toDate?.()
  if (!date) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const groupId = profile?.group_id
  const [territoryIds, setTerritoryIds] = useState([])
  const [callRecords, setCallRecords] = useState([])
  const [completedAssignments, setCompletedAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(query(collection(db, 'territories'), where('group_id', '==', groupId)), (snap) =>
      setTerritoryIds(snap.docs.map((d) => d.id)),
    )
  }, [groupId])

  useEffect(() => {
    if (territoryIds.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetchByTerritoryIdChunks('call_records', territoryIds),
      fetchByTerritoryIdChunks('territory_assignments', territoryIds, where('status', '==', 'completed')),
    ]).then(([calls, assignments]) => {
      setCallRecords(calls)
      setCompletedAssignments(assignments)
      setLoading(false)
    })
  }, [territoryIds])

  const chartData = useMemo(() => {
    const doorsByMonth = {}
    for (const record of callRecords) {
      const key = monthKey(record.recorded_at)
      if (!key) continue
      doorsByMonth[key] = (doorsByMonth[key] || 0) + 1
    }

    const mapsByMonth = {}
    const seenPerMonth = {}
    for (const assignment of completedAssignments) {
      const key = monthKey(assignment.completed_at)
      if (!key) continue
      seenPerMonth[key] = seenPerMonth[key] || new Set()
      if (!seenPerMonth[key].has(assignment.territory_id)) {
        seenPerMonth[key].add(assignment.territory_id)
        mapsByMonth[key] = (mapsByMonth[key] || 0) + 1
      }
    }

    const allMonths = [...new Set([...Object.keys(doorsByMonth), ...Object.keys(mapsByMonth)])].sort()

    return allMonths.map((key) => ({
      month: monthLabel(key),
      Doors: doorsByMonth[key] || 0,
      Maps: mapsByMonth[key] || 0,
    }))
  }, [callRecords, completedAssignments])

  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Doors called &amp; maps completed per month</h2>
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No activity recorded yet.</p>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Doors" fill="#2F56D9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Maps" fill="#96ABEF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
