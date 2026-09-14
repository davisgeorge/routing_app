import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import ActiveRoutesPanel from '../../components/routes/ActiveRoutesPanel'
import RoutePicker from '../../components/routes/RoutePicker'

const TABS = [
  { id: 'active', label: 'My active routes' },
  { id: 'create', label: 'Create a new route' },
]

/**
 * "My Routes" — available to every role. A user/admin's own group is fixed;
 * a super admin isn't tied to one group, so they pick which one to route in.
 */
export default function MyRoutesPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [tab, setTab] = useState('active')
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')

  useEffect(() => {
    if (!isSuperAdmin) return
    return onSnapshot(collection(db, 'groups'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setGroups(list)
      setSelectedGroupId((prev) => prev || list[0]?.id || '')
    })
  }, [isSuperAdmin])

  const groupId = isSuperAdmin ? selectedGroupId : profile?.group_id

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isSuperAdmin && tab === 'create' && (
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
        )}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'active' ? (
          <ActiveRoutesPanel />
        ) : groupId ? (
          <RoutePicker groupId={groupId} onSaved={() => setTab('active')} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400 dark:text-slate-500">
            Select a group above to browse its territories.
          </div>
        )}
      </div>
    </div>
  )
}
