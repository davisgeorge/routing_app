import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import MembersTable from '../../components/territories/MembersTable'

/**
 * Super admin isn't tied to one group, so — same pattern as MyRoutesPage —
 * they pick which group's members to manage. Reuses MembersTable, which was
 * already built to work for either an admin (their own group) or a super
 * admin (any group).
 */
export default function MembersPage() {
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')

  useEffect(() => {
    return onSnapshot(collection(db, 'groups'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setGroups(list)
      setSelectedGroupId((prev) => prev || list[0]?.id || '')
    })
  }, [])

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Members</h1>
        <select
          className="input max-w-[16rem]"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
        >
          {groups.length === 0 && <option value="">No groups yet</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {selectedGroupId ? (
        <MembersTable groupId={selectedGroupId} />
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">No groups yet — create an administrator first.</p>
      )}
    </div>
  )
}
