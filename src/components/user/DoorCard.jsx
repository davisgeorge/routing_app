import { useState } from 'react'
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const OPTIONS = [
  { value: 'H', label: 'Home' },
  { value: 'NH', label: 'Not Home' },
  { value: 'NLH', label: 'No Longer Hindi' },
]

/**
 * Records a door visit (H / NH / NLH) as an immutable call_record.
 * call_number counts this publisher's own prior visits to the address —
 * that's all the security rules let a non-admin user read back.
 */
export default function DoorCard({ address, territoryId, source = 'assigned', onRecorded }) {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [lastStatus, setLastStatus] = useState(null)

  const record = async (status) => {
    setSubmitting(status)
    setError('')
    try {
      const priorSnap = await getDocs(
        query(
          collection(db, 'call_records'),
          where('address_id', '==', address.id),
          where('recorded_by', '==', user.uid),
        ),
      )
      await addDoc(collection(db, 'call_records'), {
        address_id: address.id,
        territory_id: territoryId,
        recorded_by: user.uid,
        call_number: priorSnap.size + 1,
        status,
        notes: notes.trim() || null,
        source,
        recorded_at: serverTimestamp(),
      })
      setLastStatus(status)
      setNotes('')
      onRecorded?.(status)
    } catch (err) {
      setError(err.message || 'Could not save this door.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="card">
      <p className="font-medium text-slate-800">
        {address.street_number} {address.unit && `Unit ${address.unit}`} {address.street_name}
      </p>
      {address.mother_tongue && <p className="text-xs text-slate-400">{address.mother_tongue}</p>}

      <input
        type="text"
        placeholder="Notes (optional)"
        className="input mt-3"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={submitting !== null}
            onClick={() => record(opt.value)}
            className={`btn-soft ${lastStatus === opt.value ? 'ring-2 ring-brand' : ''}`}
          >
            {submitting === opt.value ? '…' : opt.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
