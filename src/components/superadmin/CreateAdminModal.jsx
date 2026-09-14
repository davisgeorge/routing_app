import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { createAuthUserWithoutSigningIn } from '../../utils/secondaryAuth'

export default function CreateAdminModal({ onClose }) {
  const [regions, setRegions] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedRegionIds, setSelectedRegionIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(
    () =>
      onSnapshot(collection(db, 'regions'), (snap) =>
        setRegions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [],
  )

  const toggleRegion = (id) => {
    setSelectedRegionIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // No Cloud Functions available, so the new admin's Auth account is
      // created via a throwaway secondary Firebase app (keeps this super
      // admin's own session signed in), then their Firestore docs are
      // written directly as this super admin.
      const uid = await createAuthUserWithoutSigningIn(email.trim(), password)

      const groupRef = doc(collection(db, 'groups'))
      const batch = writeBatch(db)
      batch.set(groupRef, {
        name: groupName,
        admin_id: uid,
        region_ids: selectedRegionIds,
        created_at: serverTimestamp(),
      })
      batch.set(doc(db, 'users', uid), {
        firebase_uid: uid,
        name,
        email: email.trim(),
        role: 'admin',
        group_id: groupRef.id,
        created_at: serverTimestamp(),
      })
      await batch.commit()

      onClose()
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'That email is already registered.' : err.message || 'Could not create the administrator.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Administrator</h2>
          <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="admin-name">Name</label>
            <input id="admin-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="admin-password">Temporary password</label>
            <input
              id="admin-password"
              type="password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="group-name">Group name</label>
            <input
              id="group-name"
              required
              placeholder="e.g. Hamilton Hindi Group"
              className="input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {regions.length > 0 && (
            <div>
              <span className="label">Regions</span>
              <div className="flex flex-wrap gap-2">
                {regions.map((region) => (
                  <label
                    key={region.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selectedRegionIds.includes(region.id)
                        ? 'border-brand bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedRegionIds.includes(region.id)}
                      onChange={() => toggleRegion(region.id)}
                    />
                    {region.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating…' : 'Create Administrator'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
