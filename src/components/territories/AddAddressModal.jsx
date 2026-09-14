import { useState } from 'react'
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { geocodeAddress } from '../../utils/geocode'

/** Adds a single address to an existing territory — admin (own group) or
 * super admin (any group). Geocodes it on the spot (one lookup, not the
 * rate-limited bulk-import path). */
export default function AddAddressModal({ territory, onClose }) {
  const [streetNumber, setStreetNumber] = useState('')
  const [unit, setUnit] = useState('')
  const [streetName, setStreetName] = useState('')
  const [motherTongue, setMotherTongue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const addressString = `${streetNumber} ${streetName}, ${territory.suburb}, New Zealand`
      const geo = await geocodeAddress(addressString)

      await addDoc(collection(db, 'addresses'), {
        territory_id: territory.id,
        street_number: streetNumber.trim(),
        unit: unit.trim() || null,
        street_name: streetName.trim(),
        suburb: territory.suburb,
        mother_tongue: motherTongue.trim() || null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        created_at: serverTimestamp(),
      })
      await updateDoc(doc(db, 'territories', territory.id), { total_addresses: increment(1) })
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add this address.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Add Address — Map {territory.map_number}{territory.map_sub}
          </h2>
          <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="addr-number">Street number</label>
              <input id="addr-number" required className="input" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="addr-unit">Unit</label>
              <input id="addr-unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="addr-street">Street name</label>
            <input id="addr-street" required className="input" value={streetName} onChange={(e) => setStreetName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="addr-suburb">Suburb</label>
            <input id="addr-suburb" disabled className="input bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400" value={territory.suburb} />
          </div>
          <div>
            <label className="label" htmlFor="addr-tongue">Mother tongue (optional)</label>
            <input
              id="addr-tongue"
              placeholder="e.g. Punjabi"
              className="input"
              value={motherTongue}
              onChange={(e) => setMotherTongue(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Adding…' : 'Add Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
