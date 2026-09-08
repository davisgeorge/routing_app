import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

const IN_CHUNK_SIZE = 30

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Best-effort client-side conflict check for self-selecting addresses —
 * there's no trusted server left to arbitrate this, so it relies on the
 * relaxed group-wide read rules for active assignments/routes (see
 * firestore.rules) and simply trusts the result. Returns the subset of
 * `addresses` that are already being worked by someone else.
 */
export async function findConflictingAddresses(addresses, { myUid, myGroupId }) {
  if (addresses.length === 0) return []

  const territoryIds = [...new Set(addresses.map((a) => a.territory_id))]
  const conflicting = new Set()

  const assignmentSnaps = await Promise.all(
    chunk(territoryIds, IN_CHUNK_SIZE).map((ids) =>
      getDocs(query(collection(db, 'territory_assignments'), where('territory_id', 'in', ids), where('status', '==', 'active'))),
    ),
  )
  const claimedTerritoryIds = new Set()
  assignmentSnaps.forEach((snap) =>
    snap.docs.forEach((d) => {
      if (d.data().user_id !== myUid) claimedTerritoryIds.add(d.data().territory_id)
    }),
  )
  addresses.forEach((a) => {
    if (claimedTerritoryIds.has(a.territory_id)) conflicting.add(a.id)
  })

  const routesSnap = await getDocs(
    query(collection(db, 'personal_routes'), where('group_id', '==', myGroupId), where('status', '==', 'active')),
  )
  const addressIdSet = new Set(addresses.map((a) => a.id))
  routesSnap.docs.forEach((d) => {
    const route = d.data()
    if (route.user_id === myUid) return
    ;(route.address_ids || []).forEach((id) => {
      if (addressIdSet.has(id)) conflicting.add(id)
    })
  })

  return [...conflicting]
}
