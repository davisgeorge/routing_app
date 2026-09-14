import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Manually creates a single territory/map — admin (own group) or super
 * admin (any group, already fixed by whichever page this is opened from). */
export default function CreateTerritoryModal({ groupId, onClose }) {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [regions, setRegions] = useState([])
  const [regionId, setRegionId] = useState('')
  const [newRegionName, setNewRegionName] = useState('')
  const [mapNumber, setMapNumber] = useState('')
  const [mapSub, setMapSub] = useState('')
  const [suburb, setSuburb] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(
    () =>
      onSnapshot(collection(db, 'regions'), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setRegions(list)
        if (list.length > 0 && !regionId) setRegionId(list[0].id)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const usingNewRegion = isSuperAdmin && regionId === '__new__'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      let finalRegionId = regionId
      if (usingNewRegion) {
        if (!newRegionName.trim()) throw new Error('Enter a name for the new region.')
        finalRegionId = slugify(newRegionName)
        await setDoc(doc(db, 'regions', finalRegionId), { name: newRegionName.trim(), created_at: serverTimestamp() }, { merge: true })
      }
      if (!finalRegionId) throw new Error('Select a region.')

      const territoryId = `${finalRegionId}-${mapNumber}${mapSub || ''}`
      await setDoc(doc(db, 'territories', territoryId), {
        region_id: finalRegionId,
        group_id: groupId,
        map_number: Number(mapNumber) || mapNumber,
        map_sub: mapSub || '',
        suburb: suburb.trim(),
        total_addresses: 0,
        status: 'available',
        created_at: serverTimestamp(),
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Could not create this territory.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New Territory</h2>
          <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="territory-region">Region</label>
            {regions.length === 0 && !isSuperAdmin ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No regions yet — ask a super admin to import data first.</p>
            ) : (
              <select id="territory-region" className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
                {isSuperAdmin && <option value="__new__">+ New region…</option>}
              </select>
            )}
          </div>

          {usingNewRegion && (
            <div>
              <label className="label" htmlFor="new-region-name">New region name</label>
              <input
                id="new-region-name"
                required
                placeholder="e.g. Rototuna"
                className="input"
                value={newRegionName}
                onChange={(e) => setNewRegionName(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="map-number">Map number</label>
              <input
                id="map-number"
                required
                inputMode="numeric"
                className="input"
                value={mapNumber}
                onChange={(e) => setMapNumber(e.target.value)}
              />
            </div>
            <div className="w-20">
              <label className="label" htmlFor="map-sub">Sub</label>
              <input id="map-sub" placeholder="a" className="input" value={mapSub} onChange={(e) => setMapSub(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="territory-suburb">Suburb</label>
            <input
              id="territory-suburb"
              required
              className="input"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={submitting || (!regionId && !isSuperAdmin)} className="btn-primary">
              {submitting ? 'Creating…' : 'Create Territory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
