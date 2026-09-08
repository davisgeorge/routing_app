import { useState } from 'react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

/**
 * Assigns a territory to one or more group members. Works for both an admin
 * (their own group) and a super admin (any group) — the security rules
 * validate group consistency server-side either way.
 */
export default function AssignPanel({ territory, members, onClose }) {
  const { user } = useAuth()
  const [selected, setSelected] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggle = (userId) =>
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))

  const handleAssign = async () => {
    if (selected.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const batch = writeBatch(db)
      for (const userId of selected) {
        batch.set(doc(collection(db, 'territory_assignments')), {
          territory_id: territory.id,
          user_id: userId,
          assigned_by: user.uid,
          status: 'active',
          route_sequence: [],
          assigned_at: serverTimestamp(),
          completed_at: null,
        })
      }
      if (territory.status === 'available') {
        batch.update(doc(db, 'territories', territory.id), { status: 'active' })
      }
      await batch.commit()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not assign this territory.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Assign Map {territory.map_number}{territory.map_sub}
          </h2>
          <button type="button" className="text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-slate-400">No publishers in this group yet — send an invite first.</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
                <span>{m.name}</span>
                <span className="text-xs text-slate-400">{m.email}</span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" disabled={submitting || selected.length === 0} className="btn-primary" onClick={handleAssign}>
            {submitting ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}
