const MAX_STOPS_PER_LEG = 10 // Google's own limit: 9 waypoints + 1 destination per directions URL

function buildLegUrl(origin, stopCoords, travelmode) {
  const destination = stopCoords[stopCoords.length - 1]
  const waypoints = stopCoords.slice(0, -1)

  const params = new URLSearchParams()
  params.set('api', '1')
  if (origin) params.set('origin', origin)
  params.set('destination', destination)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  params.set('travelmode', travelmode)

  return 'https://www.google.com/maps/dir/?' + params.toString()
}

/**
 * Builds one or more free, keyless Google Maps "dir" URLs — same pattern as
 * the route_planner.html prototype: OSRM only decides the stop ORDER
 * (already computed by optimiseRoute/reoptimiseRemaining elsewhere), then
 * Google's own app/website does the actual turn-by-turn navigation with its
 * own live-traffic routing and voice guidance. No API key or billing
 * account needed — this is Google's public "Universal URL" scheme, not the
 * paid Maps Platform API.
 *
 * A single directions URL can't hold more than 10 stops, so a longer route
 * is split into consecutive legs instead of silently dropping the rest —
 * each leg after the first starts where the previous one ends, so opening
 * them in order covers every address in the route.
 */
export function buildGoogleMapsLegs(originPosition, orderedAddresses, { travelmode = 'driving' } = {}) {
  const stops = orderedAddresses
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => `${a.lat},${a.lng}`)

  if (stops.length === 0) return []

  const legs = []
  let origin = originPosition ? `${originPosition.lat},${originPosition.lng}` : null
  for (let i = 0; i < stops.length; i += MAX_STOPS_PER_LEG) {
    const chunk = stops.slice(i, i + MAX_STOPS_PER_LEG)
    legs.push({ url: buildLegUrl(origin, chunk, travelmode), stopCount: chunk.length })
    origin = chunk[chunk.length - 1]
  }
  return legs
}
