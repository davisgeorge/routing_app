import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { createAuthUserWithoutSigningIn } from './secondaryAuth'

/**
 * Admin/super admin creates a publisher (role: 'user') account directly,
 * with a temporary password — no invite link needed. Two sequential writes
 * (not one atomic batch): the users doc must exist before the group_members
 * rule's role/group_id check can read it.
 */
export async function createPublisherAccount({ name, email, password, groupId }) {
  const uid = await createAuthUserWithoutSigningIn(email, password)

  await setDoc(doc(db, 'users', uid), {
    firebase_uid: uid,
    name,
    email,
    role: 'user',
    group_id: groupId,
    created_at: serverTimestamp(),
  })

  await setDoc(doc(collection(db, 'group_members')), {
    group_id: groupId,
    user_id: uid,
    status: 'active',
    joined_at: serverTimestamp(),
  })

  return uid
}
