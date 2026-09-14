import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import JoinRequestsPanel from '../../components/territories/JoinRequestsPanel'
import InvitePublisherForm from '../../components/territories/InvitePublisherForm'
import CreatePublisherModal from '../../components/territories/CreatePublisherModal'
import TerritoriesTable from '../../components/territories/TerritoriesTable'

export default function AdminOverview() {
  const { profile } = useAuth()
  const groupId = profile?.group_id
  const [territories, setTerritories] = useState([])
  const [members, setMembers] = useState([])
  const [creatingPublisher, setCreatingPublisher] = useState(false)

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(query(collection(db, 'territories'), where('group_id', '==', groupId)), (snap) =>
      setTerritories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(
      query(collection(db, 'users'), where('group_id', '==', groupId), where('role', '==', 'user')),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [groupId])

  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Territories</h1>

      <JoinRequestsPanel groupId={groupId} />

      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Publishers</h2>
          <button type="button" className="btn-soft" onClick={() => setCreatingPublisher(true)}>
            + Create Publisher
          </button>
        </div>
        <InvitePublisherForm groupId={groupId} />
      </div>

      <TerritoriesTable
        territories={territories}
        members={members}
        groupId={groupId}
        getDetailLink={(t) => `territories/${t.id}`}
        emptyMessage="No territories yet — ask a super admin to import data for your group."
      />

      {creatingPublisher && (
        <CreatePublisherModal groupId={groupId} onClose={() => setCreatingPublisher(false)} />
      )}
    </div>
  )
}
