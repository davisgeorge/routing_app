import { useState } from 'react'
import { createPublisherAccount } from '../../utils/createPublisher'

/** Directly creates a publisher account in the given group — no invite link
 * needed. Works for an admin (their own group) or a super admin (any group,
 * already fixed by whichever group page this is opened from). */
export default function CreatePublisherModal({ groupId, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createPublisherAccount({ name, email: email.trim(), password, groupId })
      onClose()
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'That email is already registered.' : err.message || 'Could not create the account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Publisher</h2>
          <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="pub-create-name">Name</label>
            <input id="pub-create-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pub-create-email">Email</label>
            <input
              id="pub-create-email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pub-create-password">Temporary password</label>
            <input
              id="pub-create-password"
              type="password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating…' : 'Create Publisher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
