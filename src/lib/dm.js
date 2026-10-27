import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const DMS = 'dms';
export const DM_RETENTION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export function isWithinRetention(createdAt, threshold) {
  if (!createdAt) {
    // Treat optimistic local writes without server timestamp as valid/current
    return true;
  }
  let timeMillis;
  if (typeof createdAt.toMillis === 'function') {
    timeMillis = createdAt.toMillis();
  } else if (typeof createdAt.toDate === 'function') {
    timeMillis = createdAt.toDate().getTime();
  } else if (typeof createdAt === 'number') {
    timeMillis = createdAt;
  } else if (createdAt instanceof Date) {
    timeMillis = createdAt.getTime();
  } else {
    timeMillis = Date.parse(createdAt);
  }
  if (Number.isNaN(timeMillis)) return true;
  return timeMillis >= threshold;
}

/** Deterministic DM room ID — same for both users, no server needed. */
export function dmRoomId(uid1, uid2) {
  return [uid1, uid2].sort().join('_dm_');
}

/** Send a DM message. Creates the parent DM doc if it doesn't exist. */
export async function sendDm(myUid, friendUid, text) {
  if (!myUid || !friendUid || !text?.trim()) return;
  const roomId = dmRoomId(myUid, friendUid);

  // Ensure the parent DM doc exists (needed for Firestore rules).
  await setDoc(
    doc(db, DMS, roomId),
    { participants: [myUid, friendUid], updatedAt: serverTimestamp() },
    { merge: true }
  );

  // Write the message into the sub-collection.
  await addDoc(collection(db, DMS, roomId, 'messages'), {
    senderUid: myUid,
    text: text.trim().slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

/** Load the last N messages for history display within the 5-day retention window. */
export async function loadDmHistory(myUid, friendUid, messageLimit = 50) {
  const roomId = dmRoomId(myUid, friendUid);
  try {
    const snap = await getDocs(
      query(
        collection(db, DMS, roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(messageLimit)
      )
    );
    const threshold = Date.now() - DM_RETENTION_MS;
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => isWithinRetention(m.createdAt, threshold))
      .reverse(); // oldest first
  } catch {
    return [];
  }
}

/** Real-time listener for new DMs within the 5-day retention window. Returns unsubscribe fn. */
export function listenToDm(myUid, friendUid, onMessages) {
  const roomId = dmRoomId(myUid, friendUid);
  const q = query(
    collection(db, DMS, roomId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const threshold = Date.now() - DM_RETENTION_MS;
      const validMessages = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => isWithinRetention(m.createdAt, threshold));
      onMessages(validMessages);
    },
    (err) => console.error('[DM] listener error:', err)
  );
}
