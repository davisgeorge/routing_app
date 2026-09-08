import { useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function dotIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:9999px;
      background:${color};border:2px solid #ffffff;
      box-shadow:0 0 0 1px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function FitBounds({ points }) {
  const map = useMap()
  useMemo(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 15)
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
    }
    // Only refit when the point set changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)])
  return null
}

/**
 * Plain address pin map — no route ordering, just dots coloured by
 * `getColor(address)` with a `getPopupText(address)` label. Used for the
 * admin's territory view and the super admin's whole-group view.
 */
export default function AddressMap({ addresses, getColor, getPopupText, height = '20rem' }) {
  const points = useMemo(() => addresses.filter((a) => a.lat != null && a.lng != null), [addresses])
  const latLngs = useMemo(() => points.map((a) => [a.lat, a.lng]), [points])

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        No geocoded addresses to show on the map yet.
      </div>
    )
  }

  return (
    <div style={{ height }}>
      <MapContainer center={latLngs[0]} zoom={14} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={latLngs} />
        {points.map((a) => (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={dotIcon(getColor ? getColor(a) : '#2F56D9')}>
            <Popup>{getPopupText ? getPopupText(a) : `${a.street_number} ${a.street_name}`}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
