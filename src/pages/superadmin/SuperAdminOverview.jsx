import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import CreateAdminModal from '../../components/superadmin/CreateAdminModal'
import InvitePublisherModal from '../../components/superadmin/InvitePublisherModal'

function StatCard({ label, value }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

export default function SuperAdminOverview() {
  const [regions, setRegions] = useState([])
  const [admins, setAdmins] = useState([])
  const [groups, setGroups] = useState([])
  const [territoryCount, setTerritoryCount] = useState(0)
  const [addressCount, setAddressCount] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'regions'), (snap) => setRegions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'users'), where('role', '==', 'admin')), (snap) =>
        setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
      onSnapshot(collection(db, 'groups'), (snap) => setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, 'territories'), (snap) => setTerritoryCount(snap.size)),
      onSnapshot(collection(db, 'addresses'), (snap) => setAddressCount(snap.size)),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  const adminNameById = Object.fromEntries(admins.map((a) => [a.id, a.name]))

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Overview</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-soft" onClick={() => setInviteModalOpen(true)} disabled={groups.length === 0}>
            + Invite Publisher
          </button>
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            + Create Administrator
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Regions" value={regions.length} />
        <StatCard label="Territories" value={territoryCount} />
        <StatCard label="Addresses" value={addressCount} />
        <StatCard label="Groups" value={groups.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Regions</h2>
          {regions.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No regions yet — import data to seed them.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {regions.map((region) => (
                <li key={region.id} className="py-2 text-sm text-slate-700 dark:text-slate-300">
                  {region.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Groups</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No groups yet — create an administrator to create one.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {groups.map((group) => (
                <li key={group.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{group.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{adminNameById[group.admin_id] || 'No admin'}</p>
                  </div>
                  <Link to={`groups/${group.id}`} className="btn-ghost px-3 py-1">View</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalOpen && <CreateAdminModal onClose={() => setModalOpen(false)} />}
      {inviteModalOpen && <InvitePublisherModal groups={groups} onClose={() => setInviteModalOpen(false)} />}
    </div>
  )
}
