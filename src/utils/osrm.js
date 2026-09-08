const OSRM_BASE = import.meta.env.VITE_OSRM_BASE_URL

/**
 * Orders a set of addresses into an efficient walking route using OSRM's
 * Trip API (foot profile). When `startLocation` ({lat,lng}, e.g. the
 * publisher's live GPS position) is given, the route starts there and picks
 * the closest address first, then continues on to the rest — the same way
 * Google Maps handles "my location" plus multiple stops. Without it, the
 * first given address is used as the start instead. Returns the address IDs
 * in visiting order (the synthetic start point, if any, is never included)
 * plus the route geometry/distance.
 */
export async function optimiseRoute(addresses, startLocation) {
  if (!addresses || addresses.length === 0) {
    return { orderedAddressIds: [], geometry: null, distanceKm: 0, durationMin: 0 }
  }
  if (addresses.length === 1 && !startLocation) {
    return { orderedAddressIds: [addresses[0].id], geometry: null, distanceKm: 0, durationMin: 0 }
  }

  const START_MARKER = '__start__'
  const points = startLocation
    ? [{ id: START_MARKER, lat: startLocation.lat, lng: startLocation.lng }, ...addresses]
    : addresses

  const coords = points.map((a) => `${a.lng},${a.lat}`).join(';')
  const url = `${OSRM_BASE}/trip/v1/foot/${coords}?source=first&roundtrip=false&overview=full&geometries=geojson`

  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Could not reach the routing service — check your connection and try again.')
  }
  if (!res.ok) {
    throw new Error('Could not calculate a route right now — check your connection and try again.')
  }
  const data = await res.json()
  if (data.code !== 'Ok' || !data.trips?.[0]) {
    throw new Error('No walking route could be found between these addresses.')
  }

  const trip = data.trips[0]
  const orderedAddressIds = data.waypoints
    .map((wp, originalIndex) => ({ waypointIndex: wp.waypoint_index, originalIndex }))
    .sort((a, b) => a.waypointIndex - b.waypointIndex)
    .map(({ originalIndex }) => points[originalIndex].id)
    .filter((id) => id !== START_MARKER)

  return {
    orderedAddressIds,
    geometry: trip.geometry, // GeoJSON LineString, [lng, lat] pairs
    distanceKm: trip.distance / 1000,
    durationMin: trip.duration / 60,
  }
}

/** Convenience wrapper when only the total walking distance is needed. */
export async function getTripDistanceKm(addresses) {
  const { distanceKm } = await optimiseRoute(addresses)
  return distanceKm
}

/**
 * Fetches the road-following path connecting addresses IN THE EXACT ORDER
 * given — no reordering (that's optimiseRoute's job). Used to keep the map's
 * route line showing the real walking path whenever a route is viewed, not
 * just right after clicking "Optimise".
 */
export async function getRouteGeometry(addresses) {
  const result = await getRouteWithSteps(addresses)
  return result?.geometry ?? null
}

/**
 * Same as getRouteGeometry, but also asks OSRM for turn-by-turn maneuver
 * steps (`steps=true`) — the actual "showing direction" data: at which point
 * along the path to turn which way onto which street. Returns
 * { geometry, steps } where each step is OSRM's raw step object (see
 * src/utils/directions.js for turning one into human-readable text).
 */
export async function getRouteWithSteps(addresses) {
  const points = (addresses || []).filter((a) => a.lat != null && a.lng != null)
  if (points.length < 2) return null

  const coords = points.map((a) => `${a.lng},${a.lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const route = data.code === 'Ok' ? data.routes?.[0] : null
    if (!route) return null
    return {
      geometry: route.geometry,
      steps: route.legs.flatMap((leg) => leg.steps),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    }
  } catch {
    return null
  }
}
