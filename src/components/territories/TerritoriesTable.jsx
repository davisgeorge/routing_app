import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TerritoryFilterBar from '../shared/TerritoryFilterBar'
import AssignPanel from './AssignPanel'
import CreateTerritoryModal from './CreateTerritoryModal'
import AddAddressModal from './AddAddressModal'
import { EMPTY_TERRITORY_FILTERS, filterTerritories } from '../../utils/territoryFilters'

const STATUS_PILL = {
  available: 'pill-available',
  active: 'pill-active',
  completed: 'pill-complete',
}

/**
 * Territories table with search/suburb/status filters, an Assign action, and
 * (when `groupId` is passed) buttons to create a new territory or add a
 * single address to an existing one. `getDetailLink(territory)` is optional —
 * omit it to hide the "View" link (no territory detail route on the super
 * admin side yet).
 */
export default function TerritoriesTable({ territories, members, emptyMessage, getDetailLink, groupId }) {
  const [filters, setFilters] = useState(EMPTY_TERRITORY_FILTERS)
  const [assignTarget, setAssignTarget] = useState(null)
  const [addAddressTarget, setAddAddressTarget] = useState(null)
  const [creatingTerritory, setCreatingTerritory] = useState(false)

  const sortedTerritories = useMemo(
    () => [...territories].sort((a, b) => (a.suburb || '').localeCompare(b.suburb || '') || Number(a.map_number) - Number(b.map_number)),
    [territories],
  )
  const visibleTerritories = useMemo(() => filterTerritories(sortedTerritories, filters), [sortedTerritories, filters])

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TerritoryFilterBar territories={territories} filters={filters} onChange={setFilters} />
        {groupId && (
          <button type="button" className="btn-soft shrink-0" onClick={() => setCreatingTerritory(true)}>
            + New Territory
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-2 pr-4">Map</th>
              <th className="py-2 pr-4">Suburb</th>
              <th className="py-2 pr-4">Addresses</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {visibleTerritories.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-300">{t.map_number}{t.map_sub}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{t.suburb}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{t.total_addresses || 0}</td>
                <td className="py-2 pr-4">
                  <span className={STATUS_PILL[t.status] || 'pill-available'}>{t.status}</span>
                </td>
                <td className="py-2 pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    {getDetailLink && (
                      <Link to={getDetailLink(t)} className="btn-ghost px-3 py-1">View</Link>
                    )}
                    {groupId && (
                      <button type="button" className="btn-ghost px-3 py-1" onClick={() => setAddAddressTarget(t)}>
                        + Address
                      </button>
                    )}
                    <button type="button" className="btn-soft px-3 py-1" onClick={() => setAssignTarget(t)}>
                      Assign
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleTerritories.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500">
                  {territories.length === 0 ? emptyMessage : 'No territories match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {assignTarget && (
        <AssignPanel territory={assignTarget} members={members} onClose={() => setAssignTarget(null)} />
      )}
      {creatingTerritory && (
        <CreateTerritoryModal groupId={groupId} onClose={() => setCreatingTerritory(false)} />
      )}
      {addAddressTarget && (
        <AddAddressModal territory={addAddressTarget} onClose={() => setAddAddressTarget(null)} />
      )}
    </div>
  )
}
