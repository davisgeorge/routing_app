import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Spinner from '../components/shared/Spinner'

export default function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { theme } = useTheme()

  const [invite, setInvite] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'invites', token))
      .then((snap) => {
        if (!snap.exists()) {
          setLoadError('This invite link is invalid.')
          return
        }
        const data = snap.data()
        if (data.status !== 'pending') {
          setLoadError('This invite has already been used.')
          return
        }
        if (data.expires_at?.toDate?.() < new Date()) {
          setLoadError('This invite has expired.')
          return
        }
        setInvite(data)
        if (data.invited_name) setName(data.invited_name)
      })
      .catch(() => setLoadError('This invite link is invalid.'))
      .finally(() => setLoadingInvite(false))
  }, [token])

  if (done) return <Navigate to="/" replace />

  // Creates a pending join_request for this invite's group, then marks the
  // invite used. Membership itself still needs the admin's approval (Join
  // requests panel) — there's no server left to do that step automatically.
  const fileJoinRequestAndConsumeInvite = async (uid) => {
    await setDoc(doc(db, 'join_requests', `${uid}_${invite.group_id}`), {
      user_id: uid,
      group_id: invite.group_id,
      status: 'pending',
      requested_at: serverTimestamp(),
      resolved_at: null,
    })
    await updateDoc(doc(db, 'invites', token), { status: 'accepted', user_id: uid }).catch(() => {})
  }

  const handleExistingUserJoin = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await fileJoinRequestAndConsumeInvite(user.uid)
      setDone(true)
    } catch (err) {
      setSubmitError(err.message || 'Could not send a join request.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewUserSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, invite.email, password)
      await setDoc(doc(db, 'users', newUser.uid), {
        firebase_uid: newUser.uid,
        name,
        email: invite.email,
        role: 'user',
        group_id: null,
        created_at: serverTimestamp(),
      })
      await fileJoinRequestAndConsumeInvite(newUser.uid)
      setDone(true)
    } catch (err) {
      setSubmitError(err.code === 'auth/email-already-in-use' ? 'An account already exists for this email — sign in instead.' : err.message || 'Could not accept this invite.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Spinner label="Checking your invite…" />
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          theme === 'dark'
            ? 'radial-gradient(60% 50% at 50% 0%, rgb(47 86 217 / 0.18), transparent), #020617'
            : 'radial-gradient(60% 50% at 50% 0%, rgb(47 86 217 / 0.08), transparent), #f8fafc',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white shadow-md shadow-brand-600/20">
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">TerritoryMap</h1>
        </div>

        <div className="card space-y-4">
          {loadError && !user ? (
            <>
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
              <button type="button" className="btn-ghost w-full" onClick={() => navigate('/login')}>
                Back to sign in
              </button>
            </>
          ) : user && profile && profile.role !== 'user' ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You're signed in as <span className="font-medium">{user.email}</span> ({profile.role.replace('_', ' ')}).
                That account type can't join a group as a publisher — sign out and use a regular account to accept
                this invite, or ask them to open the link themselves.
              </p>
              <button type="button" className="btn-ghost w-full" onClick={() => navigate('/')}>
                Back to dashboard
              </button>
            </>
          ) : user ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You're signed in as <span className="font-medium">{user.email}</span>. Send a request to join{' '}
                <span className="font-medium">{invite?.group_name}</span>?
              </p>
              {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}
              <button type="button" disabled={submitting} className="btn-primary w-full" onClick={handleExistingUserJoin}>
                {submitting ? 'Sending…' : 'Request to join'}
              </button>
            </>
          ) : (
            <form onSubmit={handleNewUserSubmit} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You've been invited to join <span className="font-medium">{invite?.group_name}</span> as{' '}
                <span className="font-medium">{invite?.email}</span>.
              </p>
              <div>
                <label className="label" htmlFor="name">Your name</label>
                <input
                  id="name"
                  required
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="password">Choose a password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Creating account…' : 'Create account & request to join'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
