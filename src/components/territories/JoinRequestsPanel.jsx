import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'

/** Pending join requests for a group, with accept/decline — works for an
 * admin (their own group) or a super admin (any group). */
export default function JoinRequestsPanel({ groupId }) {
  const [requests, setRequests] = useState([])
  const [names, setNames] = useState({})

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(
      query(collection(db, 'join_requests'), where('group_id', '==', groupId), where('status', '==', 'pending')),
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(query(collection(db, 'users'), where('group_id', '==', groupId)), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data().name })
      setNames(map)
    })
  }, [groupId])

  const resolve = async (request, decision) => {
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'join_requests', request.id), { status: decision, resolved_at: serverTimestamp() })
      if (decision === 'accepted') {
        batch.update(doc(db, 'users', request.user_id), { group_id: groupId })
        batch.set(doc(collection(db, 'group_members')), {
          group_id: groupId,
          user_id: request.user_id,
          status: 'active',
          joined_at: serverTimestamp(),
        })
      }
      await batch.commit()
    } catch {
      // Best-effort — the request stays visible to retry if this failed.
    }
  }

  if (requests.length === 0) return null

  return (
    <div className="card mb-6">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Join requests</h2>
      <ul className="divide-y divide-slate-100">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <span>{names[r.user_id] || r.user_id}</span>
            <div className="flex gap-2">
              <button type="button" className="btn-soft" onClick={() => resolve(r, 'accepted')}>Accept</button>
              <button type="button" className="btn-ghost" onClick={() => resolve(r, 'declined')}>Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
