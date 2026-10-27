import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const FRIENDS_COLL = 'friends';
const REQUESTS_COLL = 'friendRequests';

function friendshipId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

/** Send a friend request to another user */
export async function sendFriendRequest({ fromUid, fromUsername, toUid }) {
  if (!fromUid || !toUid || fromUid === toUid) return;
  const requestId = `${fromUid}_${toUid}`;
  await setDoc(doc(db, REQUESTS_COLL, requestId), {
    fromUid,
    fromUsername: fromUsername || 'Stranger',
    toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

/** Accept a pending friend request */
export async function acceptFriendRequest(request) {
  const { fromUid, toUid, id } = request;
  const fid = friendshipId(fromUid, toUid);

  // Get user details for both
  const fromSnap = await getDoc(doc(db, 'users', fromUid));
  const toSnap = await getDoc(doc(db, 'users', toUid));

  const fromData = fromSnap.exists() ? fromSnap.data() : { username: 'Friend' };
  const toData = toSnap.exists() ? toSnap.data() : { username: 'Friend' };

  await setDoc(doc(db, FRIENDS_COLL, fid), {
    users: [fromUid, toUid],
    userMap: {
      [fromUid]: { username: fromData.username, occupation: fromData.occupation || '' },
      [toUid]: { username: toData.username, occupation: toData.occupation || '' },
    },
    createdAt: serverTimestamp(),
  });

  // Remove request after accepting
  await deleteDoc(doc(db, REQUESTS_COLL, id)).catch(() => {});
}

/** Reject / Cancel friend request */
export async function rejectFriendRequest(requestId) {
  await deleteDoc(doc(db, REQUESTS_COLL, requestId)).catch(() => {});
}

/** Remove a friend connection */
export async function removeFriend(myUid, friendUid) {
  const fid = friendshipId(myUid, friendUid);
  await deleteDoc(doc(db, FRIENDS_COLL, fid)).catch(() => {});
}

/** Check if two users are already friends */
export async function checkIsFriend(myUid, otherUid) {
  if (!myUid || !otherUid) return false;
  const fid = friendshipId(myUid, otherUid);
  const snap = await getDoc(doc(db, FRIENDS_COLL, fid));
  return snap.exists();
}

/** Check if a pending friend request exists between users */
export async function checkPendingRequest(fromUid, toUid) {
  if (!fromUid || !toUid) return null;
  const reqId = `${fromUid}_${toUid}`;
  const snap = await getDoc(doc(db, REQUESTS_COLL, reqId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Listen to incoming friend requests */
export function listenToPendingRequests(uid, callback) {
  if (!uid) return () => {};
  const q = query(
    collection(db, REQUESTS_COLL),
    where('toUid', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

/**
 * Listen to active friends list with LIVE REAL-TIME user profile sync.
 * When a friend updates their display name or occupation in Firestore,
 * this listener immediately updates their friend card everywhere without refreshing.
 */
export function listenToFriends(uid, callback) {
  if (!uid) return () => {};

  let userUnsubs = {};
  let currentProfiles = {};

  const q = query(collection(db, FRIENDS_COLL), where('users', 'array-contains', uid));

  const rootUnsub = onSnapshot(
    q,
    (snap) => {
      const friendships = snap.docs.map((d) => {
        const data = d.data();
        const friendUid = data.users.find((u) => u !== uid);
        return {
          friendshipId: d.id,
          uid: friendUid,
          fallbackMap: data.userMap?.[friendUid] || {},
        };
      }).filter((f) => !!f.uid);

      // Clean up listeners for removed friends
      const activeFriendUids = new Set(friendships.map((f) => f.uid));
      Object.keys(userUnsubs).forEach((fUid) => {
        if (!activeFriendUids.has(fUid)) {
          userUnsubs[fUid]();
          delete userUnsubs[fUid];
          delete currentProfiles[fUid];
        }
      });

      const notify = () => {
        const fullFriends = friendships.map((f) => {
          const liveUser = currentProfiles[f.uid] || {};
          return {
            friendshipId: f.friendshipId,
            uid: f.uid,
            username: liveUser.username || f.fallbackMap.username || 'Friend',
            occupation: liveUser.occupation || f.fallbackMap.occupation || 'Member',
            country: liveUser.country || 'Global',
            trustScore: liveUser.trustScore ?? 100,
            photoURL: liveUser.photoURL || null,
          };
        });
        callback(fullFriends);
      };

      // Set up live user doc listener for each friend
      friendships.forEach((f) => {
        if (!userUnsubs[f.uid]) {
          userUnsubs[f.uid] = onSnapshot(
            doc(db, 'users', f.uid),
            (userSnap) => {
              if (userSnap.exists()) {
                currentProfiles[f.uid] = userSnap.data();
              }
              notify();
            },
            (err) => {
              console.warn('[friends] user doc listener error:', err);
              notify();
            }
          );
        }
      });

      notify();
    },
    (err) => {
      console.error('[friends] listenToFriends error:', err);
      callback([]);
    }
  );

  return () => {
    rootUnsub();
    Object.values(userUnsubs).forEach((unsub) => unsub());
    userUnsubs = {};
    currentProfiles = {};
  };
}
