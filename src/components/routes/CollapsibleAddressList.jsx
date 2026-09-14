import { useState } from 'react'
import AddressStatusList from './AddressStatusList'

function ChevronIcon({ up }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

/**
 * The numbered address list as a collapsible strip (collapsed by default)
 * instead of a fixed-height panel — so the map above gets the majority of
 * the screen, and the list is only as big as the user actually wants it.
 */
export default function CollapsibleAddressList({ addresses, statusByAddressId, currentAddressId }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300"
      >
        <span>Addresses ({addresses.length})</span>
        <ChevronIcon up={expanded} />
      </button>
      {expanded && (
        <div className="max-h-64 overflow-y-auto border-t border-slate-100 dark:border-slate-800">
          <AddressStatusList addresses={addresses} statusByAddressId={statusByAddressId} currentAddressId={currentAddressId} />
        </div>
      )}
    </div>
  )
}
