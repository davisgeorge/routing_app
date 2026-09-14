import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc as fsDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { optimiseRoute } from '../../utils/osrm'
import { getCurrentPositionOnce } from '../../hooks/useLiveLocation'
import { findConflictingAddresses } from '../../utils/personalRouteConflicts'

function markerIcon(selected, conflicted) {
  const color = conflicted ? '#dc2626' : '#2F56D9'
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${selected ? color : '#ffffff'};border:2px solid ${color};"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function ChevronIcon({ up }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

/**
 * Tap-to-select map for building a new personal route within `groupId`.
 * Used by all three roles — a regular user/admin's own group is fixed, a
 * super admin picks which group first (see MyRoutesPage) and passes it here.
 */
export default function RoutePicker({ groupId, onSaved }) {
  const { user } = useAuth()
  const [territories, setTerritories] = useState([])
  const [territoryId, setTerritoryId] = useState('')
  const [addresses, setAddresses] = useState([])
  const [selected, setSelected] = useState(new Map()) // id -> address, accumulates across territory switches
  const [routeName, setRouteName] = useState('')
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState([])
  const [error, setError] = useState('')
  const [savedRouteId, setSavedRouteId] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(query(collection(db, 'territories'), where('group_id', '==', groupId)), (snap) =>
      setTerritories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [groupId])

  useEffect(() => {
    setTerritoryId('')
    setSelected(new Map())
  }, [groupId])

  useEffect(() => {
    if (!territoryId) { setAddresses([]); return }
    return onSnapshot(query(collection(db, 'addresses'), where('territory_id', '==', territoryId)), (snap) =>
      setAddresses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [territoryId])

  const toggle = (address) => {
    setConflicts([])
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(address.id)) next.delete(address.id)
      else next.set(address.id, address)
      return next
    })
  }

  const selectedList = useMemo(() => [...selected.values()], [selected])
  const points = useMemo(() => addresses.filter((a) => a.lat != null && a.lng != null), [addresses])

  const handleSave = async () => {
    if (selectedList.length === 0) return
    setSaving(true)
    setError('')
    setConflicts([])
    setSavedRouteId(null)
    try {
      const foundConflicts = await findConflictingAddresses(selectedList, { myUid: user.uid, myGroupId: groupId })
      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts)
        return
      }

      const routeRef = await addDoc(collection(db, 'personal_routes'), {
        user_id: user.uid,
        group_id: groupId,
        name: routeName || null,
        status: 'active',
        address_ids: selectedList.map((a) => a.id),
        created_at: serverTimestamp(),
      })

      const geocodedSelection = selectedList.filter((a) => a.lat != null && a.lng != null)
      // Start the route from wherever the publisher is standing right now,
      // so the first stop suggested is genuinely the closest one — not just
      // whichever address happened to be selected first.
      const startLocation = await getCurrentPositionOnce()
      const { orderedAddressIds } = await optimiseRoute(geocodedSelection, startLocation)
      if (orderedAddressIds.length > 0) {
        await updateDoc(fsDoc(db, 'personal_routes', routeRef.id), { address_ids: orderedAddressIds })
      }
      setSavedRouteId(routeRef.id)
      setSelected(new Map())
      setRouteName('')
      onSaved?.()
    } catch (err) {
      setError(err.message || 'Could not save this route.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar on desktop (md:flex-col, real box); on mobile this wrapper
          disappears (display:contents) so its two children — territory
          picker and the collapsible selection panel — become direct
          siblings of the map below and can be reordered around it. */}
      <div className="contents md:flex md:w-96 md:flex-none md:flex-col md:overflow-y-auto md:border-r md:border-slate-200 dark:md:border-slate-700">
        {/* Territory picker — compact, always visible, first on both layouts */}
        <div className="order-1 shrink-0 border-b border-slate-200 p-4 dark:border-slate-700 md:border-b-0">
          <label className="label" htmlFor="territory">Territory</label>
          <select id="territory" className="input" value={territoryId} onChange={(e) => setTerritoryId(e.target.value)}>
            <option value="">Select a territory…</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>Map {t.map_number}{t.map_sub} — {t.suburb}</option>
            ))}
          </select>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Tap pins on the map to add them to your route.</p>
        </div>

        {/* Selected addresses / route name / save — collapsible strip on
            mobile (map gets the space instead), plain always-open panel on
            desktop where there's room for both side by side with the map. */}
        <div className="order-3 shrink-0 border-t border-slate-200 dark:border-slate-700 md:order-none md:flex md:flex-1 md:flex-col md:border-t-0 md:p-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 md:hidden"
          >
            <span>Selected addresses ({selectedList.length})</span>
            <ChevronIcon up={expanded} />
          </button>

          <div className={`${expanded ? 'block' : 'hidden'} px-4 pb-4 md:block md:flex-1 md:overflow-y-auto md:px-0 md:pb-0`}>
            <div className="mb-4">
              <label className="label" htmlFor="route-name">Route name (optional)</label>
              <input
                id="route-name"
                className="input"
                placeholder="e.g. Saturday run"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
              />
            </div>

            <div className="mb-4 max-h-56 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
              {selectedList.length === 0 ? (
                <p className="p-3 text-sm text-slate-400 dark:text-slate-500">No addresses selected yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedList.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className={conflicts.includes(a.id) ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}>
                        {a.street_number} {a.street_name}
                      </span>
                      <button type="button" className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400" onClick={() => toggle(a)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {conflicts.length > 0 && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                {conflicts.length} address{conflicts.length === 1 ? ' is' : 'es are'} already being worked by someone else
                (highlighted above) — remove {conflicts.length === 1 ? 'it' : 'them'} and save again.
              </p>
            )}
            {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {savedRouteId && <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">Route saved — find it under "My active routes".</p>}
          </div>

          {/* Save stays reachable with one tap regardless of collapse state. */}
          <div className="border-t border-slate-100 p-4 dark:border-slate-800 md:border-t-0 md:p-0 md:pt-4">
            <button type="button" disabled={saving || selectedList.length === 0} className="btn-primary w-full" onClick={handleSave}>
              {saving ? 'Saving…' : `Save route (${selectedList.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Map — dominant on mobile (order-2, flex-1), unchanged on desktop */}
      <div className="order-2 min-h-0 flex-1 md:order-none">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            {territoryId ? 'No geocoded addresses in this territory.' : 'Pick a territory to see its addresses.'}
          </div>
        ) : (
          <MapContainer center={[points[0].lat, points[0].lng]} zoom={15} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((a) => (
              <Marker
                key={a.id}
                position={[a.lat, a.lng]}
                icon={markerIcon(selected.has(a.id), conflicts.includes(a.id))}
                eventHandlers={{ click: () => toggle(a) }}
              >
                <Popup>{a.street_number} {a.street_name}</Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
