import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const BLOCKS   = 'blocks';
const REPORTS  = 'reports';
const FEEDBACK = 'feedback';
const USERS    = 'users';

function blockId(blockerUid, blockedUid) {
  return `${blockerUid}_${blockedUid}`;
}

// ---------------------------------------------------------------------------
// blockUser / unblockUser
// ---------------------------------------------------------------------------
export async function blockUser(blockerUid, blockedUid) {
  if (!blockerUid || !blockedUid || blockerUid === blockedUid) return;
  await setDoc(doc(db, BLOCKS, blockId(blockerUid, blockedUid)), {
    blockerUid,
    blockedUid,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(blockerUid, blockedUid) {
  await deleteDoc(doc(db, BLOCKS, blockId(blockerUid, blockedUid))).catch(() => {});
}

// ---------------------------------------------------------------------------
// checkIsBanned — reads from Firestore directly.
// Used server-side (Firestore rules) AND client-side (UI guard).
// ---------------------------------------------------------------------------
export async function checkIsBanned(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, USERS, uid));
    if (snap.exists()) {
      const d = snap.data();
      return Boolean(d.isBanned || (d.strikeCount && d.strikeCount >= 3));
    }
  } catch {
    /* safe default */
  }
  return false;
}

// ---------------------------------------------------------------------------
// getExclusionSet — bidirectional block lookup.
// ---------------------------------------------------------------------------
export async function getExclusionSet(uid) {
  const excluded = new Set();
  try {
    const [iBlocked, blockedMe] = await Promise.all([
      getDocs(query(collection(db, BLOCKS), where('blockerUid', '==', uid))),
      getDocs(query(collection(db, BLOCKS), where('blockedUid', '==', uid))),
    ]);
    iBlocked.forEach((d) => excluded.add(d.data().blockedUid));
    blockedMe.forEach((d) => excluded.add(d.data().blockerUid));
  } catch {
    /* return empty set — matching will still work */
  }
  return excluded;
}

// ---------------------------------------------------------------------------
// reportUser — Security model:
//
//  • The REPORT document itself is written by the caller (allowed by rules).
//  • Sensitive moderation fields are never written from the browser. A trusted
//    backend (for example, a Cloud Function) must review reports and apply any
//    strike or ban using the Admin SDK.
// ---------------------------------------------------------------------------
export async function reportUser({ reporterUid, reportedUid, roomId, reason, details }) {
  if (!reporterUid || !reportedUid || reporterUid === reportedUid) return;

  // Deduplication: one report per (reporter, reportedUid, roomId).
  const dedupId = `${reporterUid}_${reportedUid}_${roomId || 'noroomid'}`;

  const existingRef = doc(db, REPORTS, dedupId);
  const existingSnap = await getDoc(existingRef).catch(() => null);
  if (existingSnap && existingSnap.exists()) {
    console.warn('[Moderation] Duplicate report blocked:', dedupId);
    return;
  }

  // Write the report document (visible to admins).
  await setDoc(existingRef, {
    reporterUid,
    reportedUid,
    roomId: roomId || null,
    reason: reason || 'unspecified',
    details: details || '',
    createdAt: serverTimestamp(),
    status: 'open',
  });

  console.info('[Moderation] Report submitted for server-side review:', dedupId);
}

// ---------------------------------------------------------------------------
// submitPostChatFeedback — records a rating for server-side trust-score
// aggregation. Clients cannot write another member's derived profile fields.
// ---------------------------------------------------------------------------
export async function submitPostChatFeedback({ fromUid, toUid, roomId, rating }) {
  if (!fromUid || !toUid || fromUid === toUid) return;

  try {
    await setDoc(doc(collection(db, FEEDBACK)), {
      fromUid,
      toUid,
      roomId: roomId || null,
      rating,
      createdAt: serverTimestamp(),
    });

    // The feedback record is intentionally the only client-side write. A
    // trusted backend can aggregate it into trustScore and chat counters.
    console.info(`[Moderation] Feedback submitted for server-side processing: ${toUid}`);
  } catch (err) {
    console.error('[Moderation] Feedback submit error:', err);
  }
}
