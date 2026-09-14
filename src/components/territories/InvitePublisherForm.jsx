import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { createInvite } from '../../utils/invites'

/** Creates an invite link for the given group — works for an admin (their own
 * group) or a super admin (any group). */
export default function InvitePublisherForm({ groupId }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setInviteLink('')
    try {
      const link = await createInvite({ groupId, name, email, invitedByUid: user.uid })
      setInviteLink(link)
      setName('')
      setEmail('')
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
    <div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="label" htmlFor="invite-name">Name</label>
          <input
            id="invite-name"
            required
            placeholder="Jane Smith"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            type="email"
            required
            placeholder="name@example.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating…' : 'Create invite link'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {inviteLink && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900 p-2 text-sm">
          <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{inviteLink}</span>
          <button type="button" className="btn-ghost px-2 py-1" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      {inviteLink && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          There's no email service on the free plan — send this link to them yourself (WhatsApp, SMS, etc).
        </p>
      )}
    </div>
  )
}
