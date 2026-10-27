import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const INVITES = 'callInvites';

/**
 * Caller: write a call invite doc for the receiver.
 * roomId = [callerUid, receiverUid].sort().join('_direct_')
 */
export async function sendCallInvite({ callerUid, callerName, receiverUid }) {
  const roomId = [callerUid, receiverUid].sort().join('_direct_');
  await setDoc(doc(db, INVITES, receiverUid), {
    callerUid,
    callerName: callerName || 'Friend',
    receiverUid,
    roomId,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  console.log(`[DirectCall] Invite sent to uid=${receiverUid}, roomId=${roomId}`);
  return roomId;
}

/** Receiver accepts — delete the invite doc (caller listens and navigates). */
export async function acceptCallInvite(receiverUid) {
  await deleteDoc(doc(db, INVITES, receiverUid)).catch(() => {});
}

/**
 * Receiver declines — update status to 'declined' instead of deleting.
 * The caller's onSnapshot listener will see the status change and show
 * a "Call Declined" notification before cleaning up.
 */
export async function declineCallInvite(receiverUid) {
  try {
    await updateDoc(doc(db, INVITES, receiverUid), {
      status: 'declined',
    });
  } catch {
    // Doc may not exist; fall back to delete.
    await deleteDoc(doc(db, INVITES, receiverUid)).catch(() => {});
  }
}

/**
 * Caller: listen to changes on the RECEIVER's invite doc so we know if it
 * was accepted or declined.
 * Returns unsubscribe fn.
 * onStatus('pending' | 'declined' | 'accepted' | 'gone') is called on change.
 */
export function listenForCallResponse(receiverUid, onStatus) {
  if (!receiverUid) return () => {};
  return onSnapshot(
    doc(db, INVITES, receiverUid),
    (snap) => {
      if (!snap.exists()) {
        onStatus('gone'); // doc deleted = accepted or timed out
      } else {
        onStatus(snap.data()?.status || 'pending');
      }
    },
    (err) => {
      console.error('[DirectCall] response listener error:', err);
    }
  );
}

/**
 * Listen for incoming call invites on the current user (receiver side).
 * Returns unsubscribe fn.
 * onInvite(inviteData | null) is called on each change.
 */
export function listenForIncomingCall(myUid, onInvite) {
  if (!myUid) return () => {};
  return onSnapshot(
    doc(db, INVITES, myUid),
    (snap) => {
      if (snap.exists() && snap.data()?.status === 'pending') {
        onInvite(snap.data());
      } else {
        onInvite(null);
      }
    },
    (err) => {
      console.error('[DirectCall] invite listener error:', err);
      onInvite(null);
    }
  );
}

/** Caller cancels the invite (e.g. navigated away before answered). */
export async function cancelCallInvite(receiverUid) {
  await deleteDoc(doc(db, INVITES, receiverUid)).catch(() => {});
}
