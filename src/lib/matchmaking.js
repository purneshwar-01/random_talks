import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const QUEUE = 'matchQueue';
const CALLS  = 'calls';

function queueRef(uid) {
  return doc(db, QUEUE, uid);
}

// ---------------------------------------------------------------------------
// joinQueue — writes the caller into the public waiting pool.
// Resets status: 'waiting', clears stale roomId and matchedWith.
// ---------------------------------------------------------------------------
export async function joinQueue({ uid, username, gender, genderFilter, mode, occupation, age }) {
  const chosenMode = mode || 'casual';
  console.log('[Matchmaking] Joined queue:', uid, 'Mode:', chosenMode);
  await setDoc(queueRef(uid), {
    uid,
    username:     username     || 'Stranger',
    gender:       gender       || 'Any',
    genderFilter: genderFilter || 'Any',
    mode:         chosenMode,
    occupation:   occupation   || '',
    age:          age          || null,
    status:       'waiting',
    roomId:       null,
    matchedWith:  null,
    joinedAt:     serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// leaveQueue — removes the caller from the queue.
// ---------------------------------------------------------------------------
export async function leaveQueue(uid) {
  if (!uid) return;
  await deleteDoc(queueRef(uid)).catch(() => {});
}

// ---------------------------------------------------------------------------
// ensureCallRoom — idempotently creates a /calls/{roomId} document.
// ---------------------------------------------------------------------------
export async function ensureCallRoom(roomId, participants, extraFields = {}) {
  const ref = doc(db, CALLS, roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: participants || [],
      status:       'active',
      isEnded:      false,
      createdAt:    serverTimestamp(),
      ...extraFields,
    });
  }
}

// ---------------------------------------------------------------------------
// markCallEnded — sets status:'ended' & isEnded: true on the call doc.
// ---------------------------------------------------------------------------
export async function markCallEnded(roomId) {
  if (!roomId) return;
  try {
    await setDoc(
      doc(db, CALLS, roomId),
      {
        status: 'ended',
        isEnded: true,
        endedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Matchmaking] markCallEnded notice:', err);
  }
}

// ---------------------------------------------------------------------------
// listenForCallEnd — real-time listener on the call doc.
// Fires onEnded() when status becomes 'ended' or isEnded is true.
// Returns unsubscribe fn.
// ---------------------------------------------------------------------------
export function listenForCallEnd(roomId, onEnded) {
  if (!roomId) return () => {};
  return onSnapshot(
    doc(db, CALLS, roomId),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.status === 'ended' || data?.isEnded === true) {
          onEnded();
        }
      }
    },
    (err) => {
      console.error('[Matchmaking] listenForCallEnd error:', err);
    }
  );
}

// ---------------------------------------------------------------------------
// tryMatch — candidate search with FIFO ordering and deadlock avoidance.
// ---------------------------------------------------------------------------
export async function tryMatch(uid, { gender, genderFilter, mode, searchAttemptCount = 0 } = {}) {
  const myMode = mode || 'casual';

  try {
    // Single-field query (no composite index needed)
    const q = query(
      collection(db, QUEUE),
      where('status', '==', 'waiting'),
      limit(80)
    );
    const snap = await getDocs(q);

    const totalWaiting = snap.docs.length;
    // Check if running on localhost / 127.0.0.1
    const isLocalhost = typeof window !== 'undefined' && Boolean(
      window.location?.hostname === 'localhost' ||
      window.location?.hostname === '127.0.0.1'
    );
    const all = snap.docs.map((d) => d.data()).filter((c) => c && c.uid);
    
    // 1. Primary candidate search: other unique users in queue (zero recent-match exclusions)
    const otherCandidates = all.filter((c) => c.uid !== uid);

    // 2. Localhost fallback: only allow self-match if no other unique users exist in queue
    let poolCandidates = otherCandidates;
    if (poolCandidates.length === 0 && isLocalhost && totalWaiting >= 2) {
      poolCandidates = all;
    }

    console.log('[Matchmaking] Active waiting candidates found:', poolCandidates.length);

    if (poolCandidates.length === 0) return null;

    // Ensure memory FIFO ordering by joinedAt
    poolCandidates.sort((a, b) => {
      const tA = a.joinedAt?.toMillis
        ? a.joinedAt.toMillis()
        : a.joinedAt?.seconds
        ? a.joinedAt.seconds * 1000
        : 0;
      const tB = b.joinedAt?.toMillis
        ? b.joinedAt.toMillis()
        : b.joinedAt?.seconds
        ? b.joinedAt.seconds * 1000
        : 0;
      return tA - tB;
    });

    // voiceonly is hermetically isolated at ALL stages.
    function isCompatibleMode(candidateMode) {
      const cm = candidateMode || 'casual';
      if (myMode === 'voiceonly') return cm === 'voiceonly';
      if (cm   === 'voiceonly') return false;

      if (searchAttemptCount <= 4) {
        // Stage 1: exact mode (casual is universal)
        return myMode === 'casual' || cm === 'casual' || cm === myMode;
      }
      // Stage 2 & 3: all non-voiceonly modes are compatible
      return true;
    }

    const modePool = poolCandidates.filter((c) => isCompatibleMode(c.mode));
    if (modePool.length === 0) return null;

    // Gender filter — both sides must accept each other.
    const myGF = genderFilter || 'Any';
    const myG  = gender       || 'Any';

    const genderPool = modePool.filter((c) => {
      const cGF = c.genderFilter || 'Any';
      const cG  = c.gender       || 'Any';
      const iAccept    = myGF === 'Any' || cG  === myGF;
      const theyAccept = cGF  === 'Any' || myG === cGF;
      return iAccept && theyAccept;
    });

    const finalPool = genderPool.length > 0 ? genderPool : modePool;

    for (const candidate of finalPool) {
      console.log('[Matchmaking] Pairing with candidate:', candidate.uid);
      const roomId = await attemptLock(uid, candidate.uid);
      if (roomId) return roomId;
    }
  } catch (err) {
    console.error('[Matchmaking] tryMatch error:', err);
    if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
  }

  return null;
}

// ---------------------------------------------------------------------------
// attemptLock — atomic room pairing and status commitment with runTransaction
// ---------------------------------------------------------------------------
async function attemptLock(myUid, otherUid) {
  const roomId = [myUid, otherUid].sort().join('_') + '_' + Date.now();
  const meRef    = queueRef(myUid);
  const otherRef = queueRef(otherUid);
  const callRef  = doc(db, CALLS, roomId);

  try {
    const assignedRoom = await runTransaction(db, async (tx) => {
      const meSnap = await tx.get(meRef);
      if (!meSnap.exists() || meSnap.data().status !== 'waiting') {
        return null;
      }

      if (myUid !== otherUid) {
        const otherSnap = await tx.get(otherRef);
        if (!otherSnap.exists() || otherSnap.data().status !== 'waiting') {
          return null;
        }

        tx.update(otherRef, {
          status: 'matched',
          roomId,
          matchedWith: myUid,
        });
      }

      tx.update(meRef, {
        status: 'matched',
        roomId,
        matchedWith: otherUid,
      });

      tx.set(callRef, {
        participants: [myUid, otherUid],
        callerUid: myUid,
        status: 'active',
        isEnded: false,
        createdAt: serverTimestamp(),
      });

      return roomId;
    });

    return assignedRoom;
  } catch (err) {
    console.error('[Matchmaking] attemptLock error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// listenForMatch — real-time listener on OUR queue doc + active queue listener
// ---------------------------------------------------------------------------
export function listenForMatch(uid, onMatched, onError, onQueueActivity) {
  console.log('[Matchmaking] Listening for match for:', uid);

  // 1. Listen for our own doc becoming status: 'matched'
  const unsubMyDoc = onSnapshot(
    queueRef(uid),
    (snap) => {
      const data = snap.data();
      if (data?.status === 'matched' && data.roomId) {
        console.log('[Matchmaking] Match found via listener:', data.roomId);
        onMatched(data.roomId);
      }
    },
    (err) => {
      console.error('[Matchmaking] listenForMatch error:', err);
      if (typeof onError === 'function') onError(err);
    }
  );

  // 2. Active listener on the waiting queue pool to auto-trigger matching when users arrive
  let unsubQueue = () => {};
  if (typeof onQueueActivity === 'function') {
    const q = query(
      collection(db, QUEUE),
      where('status', '==', 'waiting'),
      limit(80)
    );
    unsubQueue = onSnapshot(
      q,
      (snap) => {
        const otherDocs = snap.docs.filter((d) => d.id !== uid);
        if (otherDocs.length > 0 || snap.docs.length >= 2) {
          onQueueActivity();
        }
      },
      (err) => {
        console.warn('[Matchmaking] Queue listener notice:', err);
      }
    );
  }

  return () => {
    unsubMyDoc();
    unsubQueue();
  };
}

// ---------------------------------------------------------------------------
// listenToWaitingQueue — informational real-time snapshot.
// ---------------------------------------------------------------------------
export function listenToWaitingQueue(onUpdate) {
  const q = query(collection(db, QUEUE), where('status', '==', 'waiting'), limit(80));
  return onSnapshot(
    q,
    (snap) => { onUpdate(snap.docs.map((d) => d.data())); },
    (err) => { console.warn('[Matchmaking] listenToWaitingQueue error:', err); }
  );
}

// ---------------------------------------------------------------------------
// getCallParticipants — one-time read of participants for a room.
// ---------------------------------------------------------------------------
export async function getCallParticipants(roomId) {
  try {
    const snap = await getDoc(doc(db, CALLS, roomId));
    return snap.exists() ? snap.data().participants || [] : [];
  } catch {
    return [];
  }
}
