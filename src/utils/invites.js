import { doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Creates an invite link for a group. Shared by the per-group invite form
 * (admin's own group, or a super admin viewing any group) and the super
 * admin's standalone "invite to any group" modal.
 */
export async function createInvite({ groupId, name, email, invitedByUid }) {
  const groupSnap = await getDoc(doc(db, 'groups', groupId))
  const token = crypto.randomUUID()

  await writeBatch(db)
    .set(doc(db, 'invites', token), {
      email: email.trim().toLowerCase(),
      invited_name: name.trim(),
      group_id: groupId,
      group_name: groupSnap.data()?.name || '',
      invited_by: invitedByUid,
      user_id: null,
      status: 'pending',
      token,
      created_at: serverTimestamp(),
      expires_at: Timestamp.fromMillis(Date.now() + SEVEN_DAYS_MS),
    })
    .commit()

  return `${window.location.origin}/invite/${token}`
}
