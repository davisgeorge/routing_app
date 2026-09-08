export function getDistinctSuburbs(territories) {
  return [...new Set(territories.map((t) => t.suburb).filter(Boolean))].sort()
}

export function filterTerritories(territories, { search, status, suburb }) {
  const q = search?.trim().toLowerCase()
  return territories.filter((t) => {
    if (status && t.status !== status) return false
    if (suburb && t.suburb !== suburb) return false
    if (q) {
      const label = `${t.map_number}${t.map_sub || ''} ${t.suburb || ''}`.toLowerCase()
      if (!label.includes(q)) return false
    }
    return true
  })
}

export const EMPTY_TERRITORY_FILTERS = { search: '', status: '', suburb: '' }
