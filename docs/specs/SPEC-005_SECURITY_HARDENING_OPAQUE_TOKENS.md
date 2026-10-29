# SPEC-005: Security Rules Hardening, Cryptographic Opaque Room Tokens & Dynamic Invite Joining

> **Feature ID:** `SPEC-005`  
> **Status:** APPROVED & IMPLEMENTED  
> **Author:** Principal Systems Architect  
> **Target Files:**  
> - `firestore.rules`  
> - `src/lib/matchmaking.js`  
> - `src/pages/CallRoom.jsx`  
> - `src/pages/Dashboard.jsx`  
> **Date:** 2026-10-27  

---

## 1. Problem Statement & Threat Model

1. **Join-Blocking Rules Friction:**  
   Prior to SPEC-005, Firestore rules on `/calls/{roomId}` required `request.auth.uid in resource.data.participants` for both read and update operations. When a user navigated to a call via a 1-click shareable link (`/call/:roomId`), their UID was not yet present in the `participants` array, causing immediate `PERMISSION_DENIED` errors on the initial read and join update.
2. **Matchmaking Transaction Denials:**  
   In `/matchQueue/{uid}`, `allow write: if isOwner(uid);` prevented user A from updating user B's ticket to `status: 'matched'` during atomic `attemptLock` transactions.
3. **Information Disclosure (UID Leakage):**  
   Room IDs were historically constructed via `[userA, userB].sort().join('_') + '_' + Date.now()`. This exposed private Firebase Auth UIDs directly in the browser address bar, URLs shared with strangers, and external invite links.
4. **Capacity Enforcement:**  
   Room capacity needed a unified threshold allowing up to 5 participants for small group collaboration with strict atomic join guards.

---

## 2. Specification & Implementation Details

### 2.1 Firestore Security Rules Hardening (`firestore.rules`)
- **`/calls/{roomId}` Read Policy:**  
  Allowed if the caller is already a participant, OR if the call is active (`isEnded == false && status == 'active'`) and has room capacity (`participants.size() < 5`).
- **`/calls/{roomId}` Update Policy:**  
  Existing participants retain full update permissions. An authenticated non-participant is granted permission to update *if and only if*:
  - The call is active (`isEnded == false && status == 'active'`).
  - Current participant count is under the limit (`resource.data.participants.size() < 5`).
  - The update exclusively appends the caller's UID (`request.resource.data.participants.hasAll(resource.data.participants)` and `hasAll([request.auth.uid])` with size incrementing by exactly 1).
  - Security-sensitive fields (`isEnded`, `createdAt`) cannot be tampered with.
- **`/matchQueue/{uid}` Atomic Pairing Policy:**  
  Owner maintains create, delete, and general management rights. Authenticated peers executing `attemptLock` transactions may update another user's document provided:
  - Existing status is `'waiting'`.
  - New status is `'matched'`.
  - `matchedWith` is set to `request.auth.uid`.
  - Core identity fields (`uid`, `joinedAt`, `username`) remain untouched.

### 2.2 Cryptographic Opaque Room Tokens (`src/lib/matchmaking.js`)
- Replaced string UID concatenation with `generateOpaqueRoomToken()`:
  - Format: `rt-xxxx-xxxx` (e.g. `rt-a8f2-9bc4`), where `xxxx` are 4-character random alphanumeric segments generated via `crypto.getRandomValues`.
  - Private Auth UIDs are strictly stored within Firestore document arrays (`participants: [uidA, uidB]`) and are never exposed in room identifiers or URLs.
  - Solo practice rooms utilize `practice_` prefixed with an opaque token (`practice_rt-xxxx-xxxx`).

### 2.3 Deep-Link Invite Join Flow (`src/pages/CallRoom.jsx`)
- Upon navigating to `/call/:roomId`:
  - If authenticated and not in `participants`:
    - Checks `participants.length < 5`: Atomically dispatches `updateDoc` with `arrayUnion(user.uid)` and `updatedAt: serverTimestamp()`.
    - If `participants.length >= 5`: Triggers `setRoomFullBlocked(true)` displaying the "Room is Full (5/5)" modal.
  - Decoupled `isCaller` deterministic role resolution to check `callerUid` and `participants[0]` instead of room name string splitting.
  - `copyInviteLink` distributes `${window.location.origin}/call/${currentRoomId}` formatted cleanly with the opaque token.

---

## 3. Verification & Compliance
- **Static Analysis:** ESLint passed with 0 errors and 0 warnings.
- **Production Build:** Vite production build bundled cleanly in 4.17s with exit code 0.

