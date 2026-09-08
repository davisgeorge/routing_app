import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import TerritoryFilterBar from '../../components/shared/TerritoryFilterBar'
import { EMPTY_TERRITORY_FILTERS, filterTerritories } from '../../utils/territoryFilters'

const STATUS_PILL = {
  available: 'pill-available',
  active: 'pill-active',
  completed: 'pill-complete',
}

/** Read-only browse of every territory in the publisher's group — not just
 * the ones assigned to them. */
export default function AllTerritoriesPage() {
  const { profile } = useAuth()
  const [territories, setTerritories] = useState([])
  const [filters, setFilters] = useState(EMPTY_TERRITORY_FILTERS)

  useEffect(() => {
    if (!profile?.group_id) return
    return onSnapshot(query(collection(db, 'territories'), where('group_id', '==', profile.group_id)), (snap) =>
      setTerritories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [profile?.group_id])

  const visible = filterTerritories(territories, filters)

  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">All Territories</h1>
      <div className="card">
        <TerritoryFilterBar territories={territories} filters={filters} onChange={setFilters} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Map</th>
                <th className="py-2 pr-4">Suburb</th>
                <th className="py-2 pr-4">Addresses</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700">{t.map_number}{t.map_sub}</td>
                  <td className="py-2 pr-4 text-slate-600">{t.suburb}</td>
                  <td className="py-2 pr-4 text-slate-600">{t.total_addresses || 0}</td>
                  <td className="py-2 pr-4">
                    <span className={STATUS_PILL[t.status] || 'pill-available'}>{t.status}</span>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    {territories.length === 0 ? 'No territories yet.' : 'No territories match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
