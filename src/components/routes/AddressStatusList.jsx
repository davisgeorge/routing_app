const STATUS_LABEL = { H: 'Home', NH: 'Not Home', NLH: 'No Longer Hindi' }
const STATUS_PILL_CLASS = { H: 'pill-complete', NH: 'pill-active', NLH: 'pill-available' }

/**
 * Scrollable list of every stop in route order, each showing the same
 * number as its map pin plus its current door status — a full overview
 * alongside the "just the next door" DoorCard, not a replacement for it.
 */
export default function AddressStatusList({ addresses, statusByAddressId, currentAddressId }) {
  if (addresses.length === 0) {
    return <p className="p-4 text-sm text-slate-400">No addresses on this route yet.</p>
  }

  return (
    <div className="divide-y divide-slate-100">
      {addresses.map((a, i) => {
        const status = statusByAddressId?.get(a.id)
        const isCurrent = a.id === currentAddressId
        return (
          <div key={a.id} className={`flex items-center gap-3 px-4 py-2.5 ${isCurrent ? 'bg-brand-50' : ''}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isCurrent ? 'bg-brand text-white' : 'border border-brand text-brand-700'
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {a.street_number} {a.unit && `Unit ${a.unit}`} {a.street_name}
              </p>
              {a.mother_tongue && <p className="truncate text-xs text-slate-400">{a.mother_tongue}</p>}
            </div>
            <span className={STATUS_PILL_CLASS[status] || 'pill-available'}>
              {STATUS_LABEL[status] || 'Not visited'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
