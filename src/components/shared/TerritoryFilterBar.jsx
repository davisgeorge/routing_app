import { useMemo } from 'react'
import { getDistinctSuburbs } from '../../utils/territoryFilters'

export default function TerritoryFilterBar({ territories, filters, onChange }) {
  const suburbs = useMemo(() => getDistinctSuburbs(territories), [territories])
  const hasActiveFilter = filters.search || filters.status || filters.suburb

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Search map # or suburb…"
        className="input max-w-[14rem]"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <select
        className="input max-w-[10rem]"
        value={filters.suburb}
        onChange={(e) => onChange({ ...filters, suburb: e.target.value })}
      >
        <option value="">All suburbs</option>
        {suburbs.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        className="input max-w-[10rem]"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="">All statuses</option>
        <option value="available">Available</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      {hasActiveFilter && (
        <button
          type="button"
          className="btn-ghost px-3 py-1"
          onClick={() => onChange({ search: '', status: '', suburb: '' })}
        >
          Clear
        </button>
      )}
    </div>
  )
}
