import { db } from '../config/firebase';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

const CALL_HISTORY_COLL = 'call_history';

/**
 * Save completed call record to Firestore call_history collection
 */
export async function saveCallRecord({
  userId,
  strangerUid = 'unknown',
  strangerName = 'Stranger',
  roomId,
  mode = 'professional',
  duration = 0,
  notes = '',
}) {
  if (!userId || duration < 2) return null;
  try {
    const recordId = roomId ? `${userId}_${roomId}` : undefined;
    if (recordId) {
      await setDoc(
        doc(db, CALL_HISTORY_COLL, recordId),
        {
          userId,
          strangerUid: strangerUid !== 'unknown' ? strangerUid : 'unknown',
          strangerName: strangerName !== 'Stranger' ? strangerName : 'Stranger',
          roomId,
          mode: mode || 'professional',
          duration: Number(duration) || 0,
          notes: notes || '',
          timestamp: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('[callHistory] Successfully persisted call record:', recordId);
      return recordId;
    }

    const docRef = await addDoc(collection(db, CALL_HISTORY_COLL), {
      userId,
      strangerUid,
      strangerName,
      roomId: roomId || 'room_' + Date.now(),
      mode,
      duration: Number(duration) || 0,
      notes: notes || '',
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('[callHistory] Successfully persisted call record:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[callHistory] Error saving call record:', err);
    return null;
  }
}

/**
 * Delete a specific call record from history
 */
export async function deleteCallRecord(recordId) {
  if (!recordId) return false;
  try {
    await deleteDoc(doc(db, CALL_HISTORY_COLL, recordId));
    return true;
  } catch (err) {
    console.error('[CallHistory] deleteCallRecord error:', err);
    return false;
  }
}

/**
 * Get call history for the last N days (strictly enforcing timestamp >= thresholdDate in JS)
 */
export async function getRecentCallHistory(userId, days = 5) {
  if (!userId) return [];
  try {
    // Query by userId only (no composite index needed)
    const q = query(collection(db, CALL_HISTORY_COLL), where('userId', '==', userId));
    const snap = await getDocs(q);
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

    return snap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const timeMs = data.timestamp?.toMillis
          ? data.timestamp.toMillis()
          : data.createdAtMs
          ? data.createdAtMs
          : data.timestamp?.seconds
          ? data.timestamp.seconds * 1000
          : Date.now();
        return { id: docSnap.id, ...data, timeMs };
      })
      .filter((call) => call.timeMs >= threshold)
      .sort((a, b) => b.timeMs - a.timeMs);
  } catch (err) {
    console.error('[callHistory] Error fetching:', err);
    return [];
  }
}

/**
 * Update notes for a specific room & user session (upserts if record not yet saved)
 */
export async function updateCallNotesByRoom(userId, roomId, notes, extra = {}) {
  if (!userId || !roomId) return null;
  try {
    const q = query(
      collection(db, CALL_HISTORY_COLL),
      where('userId', '==', userId),
      where('roomId', '==', roomId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docRef = snap.docs[0].ref;
      await updateDoc(docRef, {
        notes: notes || '',
        updatedAt: serverTimestamp(),
      });
      return snap.docs[0].id;
    } else {
      // Create session draft record so note is never lost on browser back
      const docRef = await addDoc(collection(db, CALL_HISTORY_COLL), {
        userId,
        roomId,
        strangerUid: extra.strangerUid || 'unknown',
        strangerName: extra.strangerName || 'Stranger',
        mode: extra.mode || 'casual',
        duration: Math.max(2, extra.duration || 2),
        notes: notes || '',
        timestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('[callHistory] Created call record with notes:', docRef.id);
      return docRef.id;
    }
  } catch (err) {
    console.error('[CallHistory] updateCallNotesByRoom error:', err);
  }
  return null;
}

/**
 * Update notes for an active/recent call record by document ID
 */
export async function updateCallNotes(historyDocId, notes) {
  if (!historyDocId) return;
  try {
    const ref = doc(db, CALL_HISTORY_COLL, historyDocId);
    await updateDoc(ref, {
      notes: notes || '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[CallHistory] updateCallNotes error:', err);
  }
}
