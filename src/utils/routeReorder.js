import { optimiseRoute } from './osrm'
import { getCurrentPositionOnce } from '../hooks/useLiveLocation'

/**
 * Recomputes the visiting order for whatever's left of a route, starting
 * from the walker's CURRENT GPS position — the same "closest first, then
 * onward" logic used when a route is first created/optimised, re-run after
 * each door so the plan keeps adapting as they actually move, the way GPS
 * navigation recalculates as you go.
 *
 * `allOrderedAddresses` is the full stop list in its current saved order;
 * `calledIds` is the set of address IDs already visited. Returns the new
 * full ID sequence to save (visited ones kept in their existing relative
 * order, upcoming ones reordered from here), or null if there's nothing
 * meaningful to do (fewer than 2 stops left, or no GPS fix available —
 * callers should just leave the existing order alone in that case).
 */
export async function reoptimiseRemaining(allOrderedAddresses, calledIds) {
  const remaining = allOrderedAddresses.filter((a) => !calledIds.has(a.id) && a.lat != null && a.lng != null)
  if (remaining.length < 2) return null

  const startLocation = await getCurrentPositionOnce()
  if (!startLocation) return null

  const { orderedAddressIds } = await optimiseRoute(remaining, startLocation)
  const calledInOrder = allOrderedAddresses.filter((a) => calledIds.has(a.id)).map((a) => a.id)
  return [...calledInOrder, ...orderedAddressIds]
}
