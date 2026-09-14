import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
      You're offline — changes will sync automatically once you're back online.
    </div>
  )
}
