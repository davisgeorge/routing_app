import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import RouteMap from '../user/RouteMap'
import DoorCard from '../user/DoorCard'
import CollapsibleAddressList from './CollapsibleAddressList'
import { getRouteGeometry, optimiseRoute } from '../../utils/osrm'
import { getCurrentPositionOnce } from '../../hooks/useLiveLocation'
import { reoptimiseRemaining } from '../../utils/routeReorder'

/**
 * Works a self-selected personal route: map + DoorCard, same experience as
 * working an assigned territory. There was previously no screen at all for
 * this — self-select could only create a route, never actually walk it.
 */
export default function ActiveRoutesPanel() {
  const { user } = useAuth()
  const [routes, setRoutes] = useState([])
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [callRecords, setCallRecords] = useState([])
  const [routeGeometry, setRouteGeometry] = useState(null)
  const [optimising, setOptimising] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'personal_routes'), where('user_id', '==', user.uid), where('status', '==', 'active')),
      (snap) => setRoutes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [user])

  useEffect(() => {
    if (!selectedRouteId && routes.length > 0) setSelectedRouteId(routes[0].id)
  }, [routes, selectedRouteId])

  const selectedRoute = routes.find((r) => r.id === selectedRouteId)

  useEffect(() => {
    if (!selectedRoute || selectedRoute.address_ids.length === 0) { setAddresses([]); return }
    let cancelled = false
    Promise.all(selectedRoute.address_ids.map((id) => getDoc(doc(db, 'addresses', id)))).then((snaps) => {
      if (!cancelled) setAddresses(snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() })))
    })
    return () => { cancelled = true }
  }, [selectedRoute])

  // Personal routes are individual, not shared, so only this user's own
  // calls count — filtered client-side to avoid needing a new composite index.
  useEffect(() => {
    if (!user) { setCallRecords([]); return }
    return onSnapshot(query(collection(db, 'call_records'), where('recorded_by', '==', user.uid)), (snap) =>
      setCallRecords(snap.docs.map((d) => d.data())),
    )
  }, [user])

  const orderedAddresses = useMemo(() => {
    if (!selectedRoute) return []
    const byId = new Map(addresses.map((a) => [a.id, a]))
    return selectedRoute.address_ids.map((id) => byId.get(id)).filter(Boolean)
  }, [addresses, selectedRoute])

  const relevantAddressIds = useMemo(() => new Set(selectedRoute?.address_ids || []), [selectedRoute])
  const calledAddressIds = useMemo(
    () => new Set(callRecords.filter((r) => relevantAddressIds.has(r.address_id)).map((r) => r.address_id)),
    [callRecords, relevantAddressIds],
  )
  const currentAddress = orderedAddresses.find((a) => !calledAddressIds.has(a.id))

  // Latest H/NH/NLH per address, for the status list below the map.
  const statusByAddressId = useMemo(() => {
    const latestAt = new Map()
    const status = new Map()
    for (const record of callRecords) {
      if (!relevantAddressIds.has(record.address_id)) continue
      const at = record.recorded_at?.toMillis?.() ?? 0
      if (!latestAt.has(record.address_id) || at > latestAt.get(record.address_id)) {
        latestAt.set(record.address_id, at)
        status.set(record.address_id, record.status)
      }
    }
    return status
  }, [callRecords, relevantAddressIds])

  // Road-following path for whatever's left of the route, recalculated as
  // doors get called — not just a static line from when it was created.
  useEffect(() => {
    const remaining = orderedAddresses.filter((a) => !calledAddressIds.has(a.id))
    let cancelled = false
    getRouteGeometry(remaining).then((geo) => {
      if (!cancelled) setRouteGeometry(geo)
    })
    return () => { cancelled = true }
  }, [orderedAddresses, calledAddressIds])

  // No server trigger is available, so whoever's client notices every stop
  // has been called marks the route completed themselves.
  useEffect(() => {
    if (!selectedRoute || orderedAddresses.length === 0) return
    if (orderedAddresses.every((a) => calledAddressIds.has(a.id))) {
      updateDoc(doc(db, 'personal_routes', selectedRoute.id), { status: 'completed' }).catch(() => {})
    }
  }, [selectedRoute, orderedAddresses, calledAddressIds])

  // After marking a door, recalculate the best order for what's LEFT from
  // the publisher's current position — GPS-style recalculation, not a plan
  // frozen at creation time.
  const handleDoorRecorded = async () => {
    if (!selectedRoute) return
    const updatedCalled = new Set(calledAddressIds)
    if (currentAddress) updatedCalled.add(currentAddress.id)
    const newSequence = await reoptimiseRemaining(orderedAddresses, updatedCalled).catch(() => null)
    if (newSequence) {
      await updateDoc(doc(db, 'personal_routes', selectedRoute.id), { address_ids: newSequence }).catch(() => {})
    }
  }

  const handleOptimise = async () => {
    if (!selectedRoute) return
    setOptimising(true)
    setError('')
    try {
      const geocoded = addresses.filter((a) => a.lat != null && a.lng != null)
      const startLocation = await getCurrentPositionOnce()
      const { orderedAddressIds } = await optimiseRoute(geocoded, startLocation)
      await updateDoc(doc(db, 'personal_routes', selectedRoute.id), { address_ids: orderedAddressIds })
    } catch (err) {
      setError(err.message || 'Could not re-optimise this route.')
    } finally {
      setOptimising(false)
    }
  }

  if (routes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-slate-400">No active self-selected routes right now — create one below.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 p-4">
        {routes.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRouteId(r.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  r.id === selectedRouteId ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                {r.name || 'Untitled route'}
              </button>
            ))}
          </div>
        )}
        <button type="button" disabled={optimising} onClick={handleOptimise} className="btn-primary w-full">
          {optimising ? 'Optimising…' : 'Re-optimise route'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Map — the dominant, flexible-space element */}
      <div className="min-h-0 flex-1">
        <RouteMap addresses={orderedAddresses} currentAddressId={currentAddress?.id} geometry={routeGeometry} />
      </div>

      {/* Current door */}
      <div className="shrink-0 border-b border-slate-200 p-4">
        {currentAddress ? (
          <DoorCard
            key={currentAddress.id}
            address={currentAddress}
            territoryId={currentAddress.territory_id}
            source="self_selected"
            onRecorded={handleDoorRecorded}
          />
        ) : (
          <p className="text-sm text-slate-400">You've visited every address on this route.</p>
        )}
      </div>

      {/* Collapsible address list, numbered to match the map pins */}
      <CollapsibleAddressList
        addresses={orderedAddresses}
        statusByAddressId={statusByAddressId}
        currentAddressId={currentAddress?.id}
      />
    </div>
  )
}
