import { useEffect, useRef, useState } from 'react'

/**
 * Wraps navigator.geolocation.watchPosition for a live "you are here" dot.
 * Geolocation requires a secure context (HTTPS, or localhost during dev) —
 * flagged explicitly here rather than failing silently, since testing over
 * a plain-HTTP LAN address (e.g. from a phone) will otherwise just do nothing.
 */
export function useLiveLocation() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!window.isSecureContext) {
      setError('Live location needs a secure connection (HTTPS) — this works on localhost or once the app is deployed.')
      return
    }
    if (!('geolocation' in navigator)) {
      setError('Location services are not available on this device.')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError('')
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access denied — enable it in your browser settings to follow your position on the map.'
            : 'Could not get your location right now.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  return { position, error }
}

/**
 * One-shot current position, used as the starting point for route
 * optimisation (so "closest first" actually means closest to where the
 * publisher is standing right now, not an arbitrary address in the list).
 * Resolves to null on any failure — callers should fall back gracefully.
 */
export function getCurrentPositionOnce() {
  return new Promise((resolve) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    )
  })
}
