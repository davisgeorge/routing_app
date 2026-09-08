import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { firebaseConfig } from '../firebase/config'

/**
 * Creates a brand-new Firebase Auth account without disturbing the caller's
 * own signed-in session. There's no Admin SDK available on the Spark plan,
 * so this is the standard client-side workaround: spin up a second,
 * throwaway Firebase App instance, create the user on ITS auth instance,
 * then tear it down. The primary app's auth state never sees any of it.
 */
export async function createAuthUserWithoutSigningIn(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid = user.uid
    await signOut(secondaryAuth)
    return uid
  } finally {
    await deleteApp(secondaryApp)
  }
}
