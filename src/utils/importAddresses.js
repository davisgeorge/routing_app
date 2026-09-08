import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { geocodeAddress } from './geocode'

const MAX_OPS_PER_BATCH = 400 // stay comfortably under Firestore's 500-op limit

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildIds(row, groupId) {
  const regionId = slugify(row.region)
  const territoryId = `${regionId}-${row.mapNumber}${row.mapSub || ''}`
  const addressId = slugify(`${groupId}__${territoryId}__${row.streetNumber}-${row.unit || ''}-${row.streetName}`)
  return { regionId, territoryId, addressId }
}

/**
 * Client-side replacement for the old importAddresses Cloud Function (no
 * Blaze plan available). Runs entirely in the super admin's browser:
 * geocodes each new address via free Nominatim (rate-limited, so this is
 * slow for a full ~2700-row import — keep the tab open) and writes
 * regions/territories/addresses in Firestore batches. Idempotent: re-running
 * with the same rows is a no-op for addresses that already exist, since doc
 * IDs are deterministic from row contents.
 *
 * onProgress receives { phase: 'checking' | 'geocoding' | 'writing', done, total }.
 */
export async function importAddresses({ rows, groupId, onProgress }) {
  const enriched = rows.map((row) => ({ row, ids: buildIds(row, groupId) }))

  const existingFlags = []
  for (let i = 0; i < enriched.length; i++) {
    const snap = await getDoc(doc(db, 'addresses', enriched[i].ids.addressId))
    existingFlags.push(snap.exists())
    onProgress?.({ phase: 'checking', done: i + 1, total: enriched.length })
  }

  const newRows = enriched.filter((_, i) => !existingFlags[i])
  const geocodeResults = new Map()
  for (let i = 0; i < newRows.length; i++) {
    const { row, ids } = newRows[i]
    const addressString = `${row.streetNumber} ${row.streetName}, ${row.suburb}, New Zealand`
    // eslint-disable-next-line no-await-in-loop
    const geo = await geocodeAddress(addressString)
    geocodeResults.set(ids.addressId, geo)
    onProgress?.({ phase: 'geocoding', done: i + 1, total: newRows.length })
    if (i < newRows.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1100))
    }
  }

  let batch = writeBatch(db)
  let opsInBatch = 0
  let imported = 0
  let skipped = 0
  let geocodeFailures = 0
  const seenTerritories = new Set()
  const seenRegions = new Set()

  // Batches must commit strictly one-at-a-time (not fired concurrently):
  // a later batch's total_addresses increment() on a territory doc would
  // race an earlier, not-yet-committed batch's set() that first creates it.
  const flush = async () => {
    if (opsInBatch > 0) {
      await batch.commit()
      batch = writeBatch(db)
      opsInBatch = 0
    }
  }

  for (let i = 0; i < enriched.length; i++) {
    const { row, ids } = enriched[i]
    const alreadyExists = existingFlags[i]

    if (opsInBatch + 4 > MAX_OPS_PER_BATCH) {
      // eslint-disable-next-line no-await-in-loop
      await flush()
    }

    if (!seenRegions.has(ids.regionId)) {
      batch.set(doc(db, 'regions', ids.regionId), { name: row.region, created_at: serverTimestamp() }, { merge: true })
      opsInBatch++
      seenRegions.add(ids.regionId)
    }

    if (!seenTerritories.has(ids.territoryId)) {
      batch.set(
        doc(db, 'territories', ids.territoryId),
        {
          region_id: ids.regionId,
          group_id: groupId,
          map_number: row.mapNumber,
          map_sub: row.mapSub || '',
          suburb: row.suburb,
          status: 'available',
          created_at: serverTimestamp(),
        },
        { merge: true },
      )
      opsInBatch++
      seenTerritories.add(ids.territoryId)
    }

    if (alreadyExists) {
      skipped++
      onProgress?.({ phase: 'writing', done: i + 1, total: enriched.length })
      continue
    }

    const geo = geocodeResults.get(ids.addressId)
    if (!geo) geocodeFailures++

    batch.set(doc(db, 'addresses', ids.addressId), {
      territory_id: ids.territoryId,
      street_number: row.streetNumber,
      unit: row.unit || null,
      street_name: row.streetName,
      suburb: row.suburb,
      mother_tongue: row.motherTongue || null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      created_at: serverTimestamp(),
    })
    opsInBatch++

    batch.update(doc(db, 'territories', ids.territoryId), { total_addresses: increment(1) })
    opsInBatch++

    imported++
    onProgress?.({ phase: 'writing', done: i + 1, total: enriched.length })
  }

  await flush()

  return { imported, skipped, geocodeFailures }
}
