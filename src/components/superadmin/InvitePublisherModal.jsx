import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { createInvite } from '../../utils/invites'

export default function InvitePublisherModal({ groups, onClose }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [groupId, setGroupId] = useState(groups[0]?.id || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!groupId) return
    setSubmitting(true)
    setError('')
    try {
      const link = await createInvite({ groupId, name, email, invitedByUid: user.uid })
      setInviteLink(link)
    } catch (err) {
      setError(err.message || 'Could not create the invite.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Invite Publisher</h2>
          <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {inviteLink ? (
          <div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Invite created. Share this link with them:</p>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900 p-2 text-sm">
              <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{inviteLink}</span>
              <button type="button" className="btn-ghost px-2 py-1" onClick={copyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              There's no email service on the free plan — send this link to them yourself (WhatsApp, SMS, etc).
            </p>
            <button type="button" className="btn-primary w-full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="pub-name">Name</label>
              <input id="pub-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pub-email">Email</label>
              <input
                id="pub-email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="pub-group">Group</label>
              <select id="pub-group" required className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groups.length === 0 && <option value="">No groups yet</option>}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={submitting || !groupId} className="btn-primary">
                {submitting ? 'Creating…' : 'Create invite link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
