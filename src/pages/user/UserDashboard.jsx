import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { getRouteGeometry, optimiseRoute } from '../../utils/osrm'
import { getCurrentPositionOnce } from '../../hooks/useLiveLocation'
import { reoptimiseRemaining } from '../../utils/routeReorder'
import { buildGoogleMapsLegs } from '../../utils/googleMapsHandoff'
import RouteMap from '../../components/user/RouteMap'
import DoorCard from '../../components/user/DoorCard'
import CollapsibleAddressList from '../../components/routes/CollapsibleAddressList'

export default function UserDashboard() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [territories, setTerritories] = useState({})
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [callRecords, setCallRecords] = useState([])
  const [optimising, setOptimising] = useState(false)
  const [routeGeometry, setRouteGeometry] = useState(null)
  const [error, setError] = useState('')
  const [openingMaps, setOpeningMaps] = useState(false)
  const [mapsLegs, setMapsLegs] = useState([])
  const autoOptimisedRef = useRef(new Set())

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'territory_assignments'), where('user_id', '==', user.uid), where('status', '==', 'active')),
      (snap) => setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [user])

  useEffect(() => {
    const unsubs = assignments.map((a) =>
      onSnapshot(doc(db, 'territories', a.territory_id), (snap) => {
        if (snap.exists()) setTerritories((prev) => ({ ...prev, [a.territory_id]: { id: snap.id, ...snap.data() } }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [assignments])

  useEffect(() => {
    if (!selectedAssignmentId && assignments.length > 0) setSelectedAssignmentId(assignments[0].id)
  }, [assignments, selectedAssignmentId])

  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId)

  useEffect(() => {
    if (!selectedAssignment) { setAddresses([]); return }
    return onSnapshot(
      query(collection(db, 'addresses'), where('territory_id', '==', selectedAssignment.territory_id)),
      (snap) => setAddresses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [selectedAssignment?.territory_id])

  useEffect(() => {
    if (!selectedAssignment) { setCallRecords([]); return }
    // Territory-wide, not just this user's own calls — with multiple
    // publishers assignable to one territory, "current door" and completion
    // both need to account for doors someone else already visited.
    return onSnapshot(
      query(collection(db, 'call_records'), where('territory_id', '==', selectedAssignment.territory_id)),
      (snap) => setCallRecords(snap.docs.map((d) => d.data())),
    )
  }, [selectedAssignment?.territory_id])

  const orderedAddresses = useMemo(() => {
    if (!selectedAssignment?.route_sequence?.length) return addresses
    const byId = new Map(addresses.map((a) => [a.id, a]))
    const ordered = selectedAssignment.route_sequence.map((id) => byId.get(id)).filter(Boolean)
    const missing = addresses.filter((a) => !selectedAssignment.route_sequence.includes(a.id))
    return [...ordered, ...missing]
  }, [addresses, selectedAssignment])

  const calledAddressIds = useMemo(() => new Set(callRecords.map((r) => r.address_id)), [callRecords])
  const currentAddress = orderedAddresses.find((a) => !calledAddressIds.has(a.id))

  // Latest H/NH/NLH per address, for the status list below the map — same
  // "latest call wins" logic as the admin's territory detail view.
  const statusByAddressId = useMemo(() => {
    const latestAt = new Map()
    const status = new Map()
    for (const record of callRecords) {
      const at = record.recorded_at?.toMillis?.() ?? 0
      if (!latestAt.has(record.address_id) || at > latestAt.get(record.address_id)) {
        latestAt.set(record.address_id, at)
        status.set(record.address_id, record.status)
      }
    }
    return status
  }, [callRecords])

  // Always keep the road-following route line current for whatever order the
  // stops are in right now — not just right after clicking "Optimise route".
  useEffect(() => {
    const remaining = orderedAddresses.filter((a) => !calledAddressIds.has(a.id))
    let cancelled = false
    getRouteGeometry(remaining).then((geo) => {
      if (!cancelled) setRouteGeometry(geo)
    })
    return () => { cancelled = true }
  }, [orderedAddresses, calledAddressIds])

  // No server trigger is available to flip territory/assignment status once
  // every door's been called, so whichever publisher's client notices it
  // happened does it themselves.
  useEffect(() => {
    if (!selectedAssignment || addresses.length === 0) return
    const territory = territories[selectedAssignment.territory_id]
    if (!territory || territory.status === 'completed') return
    if (calledAddressIds.size < addresses.length) return

    updateDoc(doc(db, 'territories', selectedAssignment.territory_id), { status: 'completed' }).catch(() => {})
    updateDoc(doc(db, 'territory_assignments', selectedAssignment.id), {
      status: 'completed',
      completed_at: serverTimestamp(),
    }).catch(() => {})
  }, [calledAddressIds, addresses.length, selectedAssignment, territories])

  // GPS-style routing as a standing feature, not a one-off button press:
  // the very first time a territory is opened with no saved order yet,
  // silently compute one starting from wherever the publisher is right now.
  useEffect(() => {
    if (!selectedAssignment) return
    if (selectedAssignment.route_sequence?.length > 0) return
    if (autoOptimisedRef.current.has(selectedAssignment.id)) return
    const geocoded = addresses.filter((a) => a.lat != null && a.lng != null)
    if (geocoded.length < 2) return

    autoOptimisedRef.current.add(selectedAssignment.id)
    getCurrentPositionOnce().then((startLocation) => {
      if (!startLocation) return
      optimiseRoute(geocoded, startLocation)
        .then(({ orderedAddressIds }) =>
          updateDoc(doc(db, 'territory_assignments', selectedAssignment.id), { route_sequence: orderedAddressIds }),
        )
        .catch(() => {})
    })
  }, [selectedAssignment, addresses])

  const handleOptimise = async () => {
    if (!selectedAssignment) return
    setOptimising(true)
    setError('')
    try {
      const geocoded = addresses.filter((a) => a.lat != null && a.lng != null)
      // Start from wherever the publisher is standing right now, so the
      // first suggested stop is genuinely the closest one.
      const startLocation = await getCurrentPositionOnce()
      const { orderedAddressIds } = await optimiseRoute(geocoded, startLocation)
      await updateDoc(doc(db, 'territory_assignments', selectedAssignment.id), { route_sequence: orderedAddressIds })
      // The road-path effect above picks up the new order automatically.
    } catch (err) {
      setError(err.message || 'Could not optimise this route.')
    } finally {
      setOptimising(false)
    }
  }

  // After marking a door, recalculate the best order for what's LEFT from
  // the publisher's current position — like GPS recalculating as you walk,
  // rather than sticking to a plan made before you'd moved at all.
  const handleDoorRecorded = async () => {
    if (!selectedAssignment) return
    const updatedCalled = new Set(calledAddressIds)
    if (currentAddress) updatedCalled.add(currentAddress.id)
    const newSequence = await reoptimiseRemaining(orderedAddresses, updatedCalled).catch(() => null)
    if (newSequence) {
      await updateDoc(doc(db, 'territory_assignments', selectedAssignment.id), { route_sequence: newSequence }).catch(() => {})
    }
  }

  // Hands off to Google's own free "dir" URL scheme (no API key/billing) —
  // OSRM only decided the stop ORDER above; Google's app does the actual
  // turn-by-turn walking navigation, live traffic/closures and voice
  // guidance, which our own OSRM-only map can't match. A single directions
  // URL tops out at 10 stops, so a longer route comes back as several legs
  // — this opens the first and keeps the rest as buttons to open in turn.
  const handleOpenInGoogleMaps = async () => {
    const pending = orderedAddresses.filter((a) => !calledAddressIds.has(a.id))
    if (pending.length === 0) return
    setOpeningMaps(true)
    const position = await getCurrentPositionOnce()
    setOpeningMaps(false)
    const legs = buildGoogleMapsLegs(position, pending)
    setMapsLegs(legs)
    if (legs.length > 0) window.open(legs[0].url, '_blank')
  }

  if (assignments.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">My territories</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500">No territories assigned to you right now.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 p-4">
        <h1 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">My territories</h1>
        <div className="mb-3 flex flex-wrap gap-2">
          {assignments.map((a) => {
            const t = territories[a.territory_id]
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAssignmentId(a.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  a.id === selectedAssignmentId ? 'border-brand bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t ? `Map ${t.map_number}${t.map_sub} — ${t.suburb}` : 'Loading…'}
              </button>
            )
          })}
        </div>
        <button type="button" disabled={optimising} onClick={handleOptimise} className="btn-primary w-full">
          {optimising ? 'Optimising…' : 'Re-optimise route'}
        </button>
        <button
          type="button"
          disabled={openingMaps || !currentAddress}
          onClick={handleOpenInGoogleMaps}
          className="btn-soft mt-2 w-full"
        >
          {openingMaps ? 'Locating you…' : '📍 Open in Google Maps'}
        </button>
        {mapsLegs.length > 1 && (
          <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-2.5">
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
              This route has too many stops for one Google Maps link, so it's split into {mapsLegs.length} legs —
              open the next one once you finish the leg before it.
            </p>
            <div className="flex flex-wrap gap-2">
              {mapsLegs.map((leg, i) => (
                <a
                  key={i}
                  href={leg.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                >
                  Leg {i + 1} ({leg.stopCount} stops)
                </a>
              ))}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* Map — the dominant, flexible-space element */}
      <div className="min-h-0 flex-1">
        <RouteMap addresses={orderedAddresses} currentAddressId={currentAddress?.id} geometry={routeGeometry} />
      </div>

      {/* Current door */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 p-4">
        {currentAddress ? (
          <DoorCard
            key={currentAddress.id}
            address={currentAddress}
            territoryId={selectedAssignment.territory_id}
            source="assigned"
            onRecorded={handleDoorRecorded}
          />
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">You've visited every address in this territory.</p>
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
