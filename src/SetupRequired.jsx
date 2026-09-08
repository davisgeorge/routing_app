const REQUIRED_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

/**
 * Shown instead of the app when Firebase env vars are missing. Without this,
 * getAuth() throws synchronously the moment firebase/config.js is imported
 * (auth/invalid-api-key), which aborts the whole render before React paints
 * anything — a blank white screen with no clue why. This page is rendered
 * from main.jsx BEFORE App/AuthContext are even imported, so that failure
 * never happens in the first place.
 */
export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-lg">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">Firebase isn't configured yet</h1>
        <p className="mb-4 text-sm text-slate-600">
          TerritoryMap needs a Firebase project before it can run. Copy <code className="rounded bg-slate-100 px-1 py-0.5">.env.example</code> to{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">.env</code> and fill in these values from your Firebase
          project settings (Project settings → General → Your apps → SDK setup and configuration):
        </p>
        <ul className="mb-4 space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
          {REQUIRED_VARS.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="text-sm text-slate-600">
          No Firebase project yet? Create one at{' '}
          <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-brand hover:underline">
            console.firebase.google.com
          </a>{' '}
          and enable Authentication (email/password) and Firestore — both work on the free Spark plan, no Cloud
          Functions required. Then restart the dev server so Vite picks up the new <code className="rounded bg-slate-100 px-1 py-0.5">.env</code>.
        </p>
      </div>
    </div>
  )
}
