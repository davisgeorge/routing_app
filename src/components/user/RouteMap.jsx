import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLiveLocation } from '../../hooks/useLiveLocation'
import { getRouteWithSteps } from '../../utils/osrm'
import { formatManeuver, formatDuration, MODIFIER_ROTATION_DEG } from '../../utils/directions'

function numberedIcon(number, isCurrent) {
  return L.divIcon({
    className: '',
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:9999px;
      background:${isCurrent ? '#2F56D9' : '#ffffff'};
      color:${isCurrent ? '#ffffff' : '#2F56D9'};
      border:2px solid #2F56D9;font-size:12px;font-weight:600;
      box-shadow:0 1px 3px rgba(0,0,0,0.3);">${number}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const liveLocationIcon = L.divIcon({
  className: '',
  html: `<div class="relative h-4 w-4">
    <div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping"></div>
    <div class="absolute inset-0 rounded-full border-2 border-white bg-blue-500 shadow-md"></div>
  </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

// Don't hit OSRM on every GPS tick — only once the walker has actually moved
// a meaningful distance (or the set of remaining stops changes).
const REFETCH_THRESHOLD_METERS = 20

function FitBounds({ points }) {
  const map = useMap()
  useMemo(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 16)
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [32, 32] })
    }
    // Only refit when the point set changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)])
  return null
}

/**
 * Keeps BOTH the live position and the current/next stop in view while
 * `following` is true — not just a tight zoom on the dot alone. A fixed
 * close zoom centered only on the walker would push the next stop's pin
 * outside the visible map whenever it's more than ~100m away, making the
 * route look disconnected even though the line is still being drawn.
 * Any manual drag (not our own programmatic pans) flips `following` off.
 */
function FollowController({ position, focusPoint, following, onUserDrag }) {
  const map = useMap()
  const lastFitRef = useRef(null)

  useMapEvents({ dragstart: onUserDrag })

  useEffect(() => {
    if (!following || !position) return
    const focusKey = focusPoint ? `${focusPoint.lat},${focusPoint.lng}` : null
    const last = lastFitRef.current
    const moved =
      !last ||
      last.focusKey !== focusKey ||
      haversineMeters(last.lat, last.lng, position.lat, position.lng) > 15
    if (!moved) return
    lastFitRef.current = { lat: position.lat, lng: position.lng, focusKey }

    if (focusPoint) {
      map.fitBounds(L.latLngBounds([[position.lat, position.lng], [focusPoint.lat, focusPoint.lng]]), {
        padding: [70, 70],
        maxZoom: 18,
        animate: true,
      })
    } else {
      map.setView([position.lat, position.lng], 18, { animate: true })
    }
  }, [position, focusPoint, following, map])

  return null
}

function LiveLocationMarker({ position }) {
  return (
    <>
      {position.accuracy && (
        <Circle
          center={[position.lat, position.lng]}
          radius={position.accuracy}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}
        />
      )}
      <Marker position={[position.lat, position.lng]} icon={liveLocationIcon} zIndexOffset={1000} />
    </>
  )
}

const GpsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

function TurnIcon({ modifier, className = 'h-7 w-7' }) {
  const rotation = MODIFIER_ROTATION_DEG[modifier] ?? 0
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`shrink-0 ${className}`} style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M12 2 L18 11 L14 11 L14 22 L10 22 L10 11 L6 11 Z" />
    </svg>
  )
}

/**
 * Shows numbered pins for an ordered stop list and — like turn-by-turn GPS
 * apps — tracks the publisher's live position with a "follow me" blue dot,
 * recentering the map as they walk. Whenever a live GPS fix is available, it
 * fetches its own road route + maneuver-by-maneuver steps from THAT exact
 * position to just the next stop (re-fetched as they actually move, not
 * just once at creation) — not a summed total across every remaining stop,
 * which would read as a much bigger distance than "how far to this door"
 * actually means. Renders a Google Maps-style navigation
 * overlay: dark map, glowing route line, big "next turn" card with a
 * secondary "Then..." preview, and a bottom ETA/distance bar. Falls back to
 * the simple pre-computed `geometry` prop and a plain distance badge when
 * GPS/live routing isn't available yet.
 */
export default function RouteMap({ addresses, currentAddressId, geometry }) {
  const { position: livePosition, error: locationError } = useLiveLocation()
  const [following, setFollowing] = useState(true)
  const [liveRoute, setLiveRoute] = useState(null)
  const lastFetchRef = useRef(null)

  const points = useMemo(
    () => addresses.filter((a) => a.lat != null && a.lng != null).map((a) => [a.lat, a.lng]),
    [addresses],
  )

  const currentIndex = addresses.findIndex((a) => a.id === currentAddressId)
  // Live turn-by-turn is scoped to just the stop being walked to right now —
  // matching how Google's nav bar works — not a summed total across every
  // remaining stop in the territory, which reads as a much bigger number
  // than what "distance to this door" actually means.
  const nextStop = useMemo(() => {
    if (currentIndex === -1) return null
    const a = addresses[currentIndex]
    return a && a.lat != null && a.lng != null ? a : null
  }, [addresses, currentIndex])

  useEffect(() => {
    if (!livePosition || !nextStop) return
    const last = lastFetchRef.current
    const closeEnough =
      last &&
      last.stopId === nextStop.id &&
      haversineMeters(last.lat, last.lng, livePosition.lat, livePosition.lng) < REFETCH_THRESHOLD_METERS
    if (closeEnough) return

    lastFetchRef.current = { lat: livePosition.lat, lng: livePosition.lng, stopId: nextStop.id }
    let cancelled = false
    getRouteWithSteps([{ lat: livePosition.lat, lng: livePosition.lng }, nextStop]).then((result) => {
      if (!cancelled) setLiveRoute(result)
    })
    return () => { cancelled = true }
  }, [livePosition, nextStop])

  const effectiveGeometry = liveRoute?.geometry ?? geometry
  const polylinePoints = useMemo(() => {
    if (!effectiveGeometry?.coordinates) return points
    return effectiveGeometry.coordinates.map(([lng, lat]) => [lat, lng])
  }, [effectiveGeometry, points])

  const nextStepIndex = useMemo(() => {
    if (!liveRoute?.steps?.length) return -1
    const idx = liveRoute.steps.findIndex((s) => s.distance > 1)
    return idx === -1 ? 0 : idx
  }, [liveRoute])
  const nextStep = nextStepIndex >= 0 ? liveRoute.steps[nextStepIndex] : null
  const thenStep = nextStepIndex >= 0 ? liveRoute.steps[nextStepIndex + 1] : null

  const currentAddress = addresses.find((a) => a.id === currentAddressId)
  const distanceToNext = useMemo(() => {
    if (!livePosition || !currentAddress || currentAddress.lat == null || currentAddress.lng == null) return null
    return haversineMeters(livePosition.lat, livePosition.lng, currentAddress.lat, currentAddress.lng)
  }, [livePosition, currentAddress])

  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        No geocoded addresses to show on the map yet.
      </div>
    )
  }

  return (
    <div className="dark-nav-map relative h-full w-full bg-[#0b1220]">
      <MapContainer center={points[0]} zoom={15} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          className="map-tiles-dark"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <FollowController
          position={livePosition}
          focusPoint={currentAddress?.lat != null ? { lat: currentAddress.lat, lng: currentAddress.lng } : null}
          following={following}
          onUserDrag={() => setFollowing(false)}
        />
        {polylinePoints.length > 1 && (
          <>
            {/* Glow halo underneath, matching Google's bright, thick nav line. */}
            <Polyline positions={polylinePoints} pathOptions={{ color: '#60a5fa', weight: 12, opacity: 0.35 }} />
            <Polyline positions={polylinePoints} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.95 }} />
          </>
        )}
        {addresses
          .filter((a) => a.lat != null && a.lng != null)
          .map((a, i) => (
            <Marker key={a.id} position={[a.lat, a.lng]} icon={numberedIcon(i + 1, a.id === currentAddressId)}>
              <Popup>
                {a.street_number} {a.unit && `Unit ${a.unit}`} {a.street_name}
              </Popup>
            </Marker>
          ))}
        {livePosition && <LiveLocationMarker position={livePosition} />}
      </MapContainer>

      {nextStep ? (
        <div className="absolute left-0 right-0 top-0 z-[1000]">
          <div className="flex items-center gap-4 bg-brand-700 px-4 py-4 text-white shadow-lg">
            <TurnIcon modifier={nextStep.maneuver.modifier} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold leading-tight">{formatManeuver(nextStep)}</p>
              <p className="text-sm text-white/80">{formatDistance(nextStep.distance)}</p>
            </div>
          </div>
          {thenStep && (
            <div className="flex items-center gap-2 bg-brand-800/95 px-4 py-1.5 text-white/90 shadow-md">
              <span className="text-xs font-medium">Then</span>
              <TurnIcon modifier={thenStep.maneuver.modifier} className="h-4 w-4" />
            </div>
          )}
        </div>
      ) : (
        distanceToNext != null && (
          <div className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md">
            {formatDistance(distanceToNext)} to next stop
          </div>
        )
      )}

      {liveRoute?.durationMin != null && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] flex items-center justify-center gap-2 bg-slate-900/95 px-4 py-3">
          <span className="text-lg font-bold text-amber-400">{formatDuration(liveRoute.durationMin)}</span>
          <span className="text-sm text-slate-300">· {liveRoute.distanceKm.toFixed(1)} km</span>
        </div>
      )}

      {!following && livePosition && (
        <button
          type="button"
          onClick={() => setFollowing(true)}
          aria-label="Recenter on my location"
          className="absolute bottom-20 right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-lg transition hover:bg-slate-50"
        >
          <GpsIcon />
        </button>
      )}

      {locationError && (
        <div className="absolute bottom-20 left-4 z-[1000] max-w-[16rem] rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 shadow-md">
          {locationError}
        </div>
      )}
    </div>
  )
}
