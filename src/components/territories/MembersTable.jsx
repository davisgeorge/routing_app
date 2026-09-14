import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'

// Firestore denies an entire query if any doc in the result set could fail
// its security rule — so we can't list territory_assignments/call_records
// unconstrained and filter client-side. Instead we chunk by user_id ('in'
// supports up to 30) and rely on the app invariant that a member's
// assignments/call records always belong to their own group's territories.
const IN_CHUNK_SIZE = 30

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchByUserIdChunks(collectionName, userIds, extraWhere) {
  const results = await Promise.all(
    chunk(userIds, IN_CHUNK_SIZE).map((ids) => {
      const clauses = [where('user_id', 'in', ids)]
      if (extraWhere) clauses.push(extraWhere)
      return getDocs(query(collection(db, collectionName), ...clauses))
    }),
  )
  return results.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
}

/** Group members with activity stats and a Remove action — works for an
 * admin (their own group) or a super admin (any group). */
export default function MembersTable({ groupId }) {
  const [members, setMembers] = useState([])
  const [users, setUsers] = useState({})
  const [assignments, setAssignments] = useState([])
  const [callRecords, setCallRecords] = useState([])
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(
      query(collection(db, 'group_members'), where('group_id', '==', groupId), where('status', '==', 'active')),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(query(collection(db, 'users'), where('group_id', '==', groupId)), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } })
      setUsers(map)
    })
  }, [groupId])

  useEffect(() => {
    const userIds = members.map((m) => m.user_id)
    if (userIds.length === 0) { setAssignments([]); return }
    let cancelled = false
    fetchByUserIdChunks('territory_assignments', userIds, where('status', '==', 'active')).then((docs) => {
      if (!cancelled) setAssignments(docs)
    })
    return () => { cancelled = true }
  }, [members])

  useEffect(() => {
    const userIds = members.map((m) => m.user_id)
    if (userIds.length === 0) { setCallRecords([]); return }
    let cancelled = false
    // call_records use `recorded_by`, not `user_id` — same chunking helper, different field.
    Promise.all(
      chunk(userIds, IN_CHUNK_SIZE).map((ids) =>
        getDocs(query(collection(db, 'call_records'), where('recorded_by', 'in', ids))),
      ),
    ).then((snaps) => {
      if (!cancelled) setCallRecords(snaps.flatMap((snap) => snap.docs.map((d) => d.data())))
    })
    return () => { cancelled = true }
  }, [members])

  const activityByUser = useMemo(() => {
    const map = {}
    for (const record of callRecords) {
      map[record.recorded_by] = (map[record.recorded_by] || 0) + 1
    }
    return map
  }, [callRecords])

  const activeTerritoriesByUser = useMemo(() => {
    const map = {}
    for (const a of assignments) {
      map[a.user_id] = (map[a.user_id] || 0) + 1
    }
    return map
  }, [assignments])

  const handleRemove = async (member) => {
    if (!window.confirm('Remove this member from the group? Their active territories will be recalled.')) return
    setRemovingId(member.id)
    try {
      const activeSnap = await getDocs(
        query(
          collection(db, 'territory_assignments'),
          where('user_id', '==', member.user_id),
          where('status', '==', 'active'),
        ),
      )

      const batch = writeBatch(db)
      batch.update(doc(db, 'group_members', member.id), { status: 'removed' })
      batch.update(doc(db, 'users', member.user_id), { group_id: null })
      const territoryIds = new Set()
      activeSnap.docs.forEach((d) => {
        batch.update(d.ref, { status: 'recalled' })
        territoryIds.add(d.data().territory_id)
      })
      await batch.commit()

      // Revert each freed-up territory to available if nothing else is
      // actively assigned to it (no server trigger to do this centrally).
      for (const territoryId of territoryIds) {
        // eslint-disable-next-line no-await-in-loop
        const remaining = await getDocs(
          query(collection(db, 'territory_assignments'), where('territory_id', '==', territoryId), where('status', '==', 'active')),
        )
        if (remaining.empty) {
          // eslint-disable-next-line no-await-in-loop
          await updateDoc(doc(db, 'territories', territoryId), { status: 'available' })
        }
      }
    } catch (err) {
      window.alert(err.message || 'Could not remove this member.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Active territories</th>
              <th className="py-2 pr-4">Doors recorded</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const u = users[m.user_id]
              return (
                <tr key={m.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-300">{u?.name || m.user_id}</td>
                  <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{u?.email || '—'}</td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{activeTerritoriesByUser[m.user_id] || 0}</td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{activityByUser[m.user_id] || 0}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      disabled={removingId === m.id}
                      className="btn-ghost px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                      onClick={() => handleRemove(m)}
                    >
                      {removingId === m.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500">No members yet — send an invite above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
