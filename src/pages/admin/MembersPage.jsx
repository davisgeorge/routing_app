import { useAuth } from '../../context/AuthContext'
import MembersTable from '../../components/territories/MembersTable'

export default function MembersPage() {
  const { profile } = useAuth()

  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Members</h1>
      <MembersTable groupId={profile?.group_id} />
    </div>
  )
}
