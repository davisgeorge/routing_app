// Client-side geocoding via OpenStreetMap's free Nominatim service — no API
// key, so nothing to keep secret, but its usage policy caps requests at 1/sec
// and expects a real browser Referer (sent automatically by fetch). That's
// why the import screen geocodes sequentially with a delay instead of
// firing everything in parallel, and why the tab needs to stay open.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const MIN_DELAY_MS = 1100

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function geocodeAddress(addressString) {
  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=nz&q=${encodeURIComponent(addressString)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const results = await res.json()
    const result = results?.[0]
    if (!result) return null
    return { lat: Number(result.lat), lng: Number(result.lon) }
  } catch {
    return null
  }
}

/**
 * Geocodes a list of address strings one at a time, respecting Nominatim's
 * rate limit. Calls onProgress(doneCount, total) after each lookup.
 */
export async function geocodeAddresses(addressStrings, onProgress) {
  const results = []
  for (let i = 0; i < addressStrings.length; i++) {
    const start = Date.now()
    results.push(await geocodeAddress(addressStrings[i]))
    onProgress?.(i + 1, addressStrings.length)
    const elapsed = Date.now() - start
    if (elapsed < MIN_DELAY_MS && i < addressStrings.length - 1) {
      await sleep(MIN_DELAY_MS - elapsed)
    }
  }
  return results
}
