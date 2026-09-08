import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import JoinRequestsPanel from '../../components/territories/JoinRequestsPanel'
import InvitePublisherForm from '../../components/territories/InvitePublisherForm'
import CreatePublisherModal from '../../components/territories/CreatePublisherModal'
import TerritoriesTable from '../../components/territories/TerritoriesTable'
import MembersTable from '../../components/territories/MembersTable'
import AddressMap from '../../components/shared/AddressMap'

const STATUS_COLOR = {
  available: '#94a3b8',
  active: '#f59e0b',
  completed: '#10b981',
}

const IN_CHUNK_SIZE = 30

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function GroupDetailPage() {
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [territories, setTerritories] = useState([])
  const [members, setMembers] = useState([])
  const [addresses, setAddresses] = useState([])
  const [creatingPublisher, setCreatingPublisher] = useState(false)

  useEffect(
    () => onSnapshot(doc(db, 'groups', groupId), (snap) => setGroup(snap.exists() ? { id: snap.id, ...snap.data() } : null)),
    [groupId],
  )

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'territories'), where('group_id', '==', groupId)), (snap) =>
        setTerritories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [groupId],
  )

  // Assign panel needs publisher (role: user) options, same as the admin view.
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'users'), where('group_id', '==', groupId), where('role', '==', 'user')),
        (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [groupId],
  )

  // Addresses are static once geocoded, so a one-time chunked fetch (not a
  // live listener) whenever the territory list settles is enough — and
  // avoids holding a real-time subscription open over possibly thousands
  // of address docs across the whole group.
  useEffect(() => {
    const territoryIds = territories.map((t) => t.id)
    if (territoryIds.length === 0) { setAddresses([]); return }
    let cancelled = false
    Promise.all(
      chunk(territoryIds, IN_CHUNK_SIZE).map((ids) =>
        getDocs(query(collection(db, 'addresses'), where('territory_id', 'in', ids))),
      ),
    ).then((snaps) => {
      if (!cancelled) setAddresses(snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    })
    return () => { cancelled = true }
  }, [territories])

  const territoryById = useMemo(() => new Map(territories.map((t) => [t.id, t])), [territories])

  return (
    <div className="p-6 md:p-8">
      <Link to="/super-admin" className="mb-4 inline-block text-sm text-brand hover:underline">← Back to overview</Link>

      <h1 className="mb-6 text-xl font-semibold text-slate-900">{group?.name || 'Group'}</h1>

      <JoinRequestsPanel groupId={groupId} />

      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Publishers</h2>
          <button type="button" className="btn-soft" onClick={() => setCreatingPublisher(true)}>
            + Create Publisher
          </button>
        </div>
        <InvitePublisherForm groupId={groupId} />
      </div>

      <div className="card mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Map ({addresses.length} addresses)</h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR.available }} />Available</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR.active }} />Active</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR.completed }} />Completed</span>
          </div>
        </div>
        <AddressMap
          addresses={addresses}
          getColor={(a) => STATUS_COLOR[territoryById.get(a.territory_id)?.status] || STATUS_COLOR.available}
          getPopupText={(a) => {
            const t = territoryById.get(a.territory_id)
            const mapLabel = t ? `Map ${t.map_number}${t.map_sub}` : ''
            return `${a.street_number} ${a.unit ? `Unit ${a.unit} ` : ''}${a.street_name} — ${mapLabel}`
          }}
          height="24rem"
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Members</h2>
      <div className="mb-6">
        <MembersTable groupId={groupId} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Territories</h2>
      <TerritoriesTable
        territories={territories}
        members={members}
        groupId={groupId}
        emptyMessage="No territories imported for this group yet."
      />

      {creatingPublisher && (
        <CreatePublisherModal groupId={groupId} onClose={() => setCreatingPublisher(false)} />
      )}
    </div>
  )
}
