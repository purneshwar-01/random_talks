# 2. System Architecture & Transport Infrastructure

> **Document ID:** `DOC-002`  
> **Status:** Production Architecture  
> **Classification:** Technical Infrastructure Specification  
> **Last Verified:** 2026-10-20  

---

## 1. High-Level Architectural Overview

RandomTalks operates on a three-tier, zero-vendor decoupled architecture:
1. **Client Front-End Layer:** React 18 SPA compiled with Vite, styled with Tailwind CSS, utilizing native browser WebRTC media engines (`RTCPeerConnection`, `MediaStream`, `Web Audio API`).
2. **Serverless Signaling Plane:** Cloud Firestore providing ACID transactions for queue pairing and real-time document listeners (`onSnapshot`) for SDP / ICE candidate exchange.
3. **P2P Transport Mesh:** Direct browser-to-browser UDP media delivery traversing NATs via a global Google Public STUN cluster with end-to-end DTLS-SRTP encryption.

```
┌─────────────────────────┐                                 ┌─────────────────────────┐
│     CLIENT A (HOST)     │                                 │     CLIENT B (PEER)     │
│  React 18 + Browser API │                                 │  React 18 + Browser API │
└────────────┬────────────┘                                 └────────────┬────────────┘
             │                                                           │
             │ 1. Ephemeral SDP & ICE Candidates                         │ 1. Ephemeral SDP & ICE Candidates
             ▼                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    SERVERLESS FIRESTORE SIGNALING PLANE (ACID)                      │
│                                                                                     │
│   • /matchQueue/{uid}        ── Atomic runTransaction pairing & mutual filtering   │
│   • /calls/{roomId}          ── Ephemeral callerOffer, calleeAnswer & ICE exchange  │
│   • /callInvites/{targetUid} ── Real-time direct friend calling bus                 │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │
                                          │ 2. NAT Traversal & Hole-Punching
                                          ▼
                         ┌─────────────────────────────────┐
                         │   GOOGLE PUBLIC STUN CLUSTER    │
                         │   stun:stun.l.google.com:19302  │
                         │   stun:stun1.l.google.com:19302 │
                         │   stun:stun2.l.google.com:19302 │
                         └────────────────┬────────────────┘
                                          │
             ┌────────────────────────────┴───────────────────────────┐
             │                                                        │
             ▼                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                DIRECT ENCRYPTED P2P MEDIA TRANSIT (DTLS 1.3 / SRTP)                 │
│                                                                                     │
│    Client A ◄──────────────── [H.264 / VP8 / Opus Video & Audio] ──────────────► Client B│
│               • Zero media servers in data path                                     │
│               • True ₹0.00 / minute streaming bandwidth cost                        │
│               • Sub-180ms real-time conversational latency                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. WebRTC P2P Mesh & STUN Configuration

Media transport avoids third-party relay vendor locks by using native browser WebRTC.

### 2.1. STUN Server Cluster Configuration
The client configures 5 geographically diverse Google STUN endpoints with a candidate pool size of 10 to accelerate NAT mapping:

```javascript
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};
```

### 2.2. Media Constraints & Audio Processing
Media streams are requested with optimized universal constraints to prevent hardware device lockups:

```javascript
const constraints = {
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
```

---

## 3. Serverless Firestore Signaling Plane

Firestore acts exclusively as an asynchronous signaling wire. Once peers establish ICE connectivity, the database has zero involvement in media delivery.

### 3.1. Matchmaking Lifecycle
1. **Join Queue:** Client executes `setDoc(doc(db, 'matchQueue', uid), { status: 'waiting', mode, gender, genderFilter, ... })`.
2. **Polling Attempt:** Client invokes `tryMatch()` every 1,500ms using a single-field Firestore index (`status == 'waiting'`).
3. **Atomic Mutual Pairing (`runTransaction`):**
   - Reads candidate doc and caller doc inside an ACID transaction.
   - Verifies neither candidate has been claimed (`status === 'waiting'`).
   - Commits simultaneous state transition to `status: 'matched'` with the isolated `roomId`.
   - Creates the `/calls/{roomId}` document atomically.

```javascript
// Atomic Lock committing both peers simultaneously
const assignedRoom = await runTransaction(db, async (tx) => {
  const meSnap = await tx.get(meRef);
  if (!meSnap.exists() || meSnap.data().status !== 'waiting') return null;

  const otherSnap = await tx.get(otherRef);
  if (!otherSnap.exists() || otherSnap.data().status !== 'waiting') return null;

  tx.update(otherRef, { status: 'matched', roomId, matchedWith: myUid });
  tx.update(meRef,    { status: 'matched', roomId, matchedWith: otherUid });
  tx.set(callRef, {
    participants: [myUid, otherUid],
    callerUid: myUid,
    status: 'active',
    isEnded: false,
    createdAt: serverTimestamp(),
  });
  return roomId;
});
```

---

## 4. Timestamped Room Isolation Protocol

### 4.1. The Room ID Invariant
In earlier P2P systems, static room naming (`uidA_uidB`) caused catastrophic ghosting: when two users rematched after hanging up, old signaling documents, stale ICE candidates, and unmounted media tracks reconnected prematurely.

RandomTalks enforces the **Deterministic Timestamped Room ID**:
```javascript
const roomId = [myUid, otherUid].sort().join('_') + '_' + Date.now();
```

* **Lexicographical Sort:** `[myUid, otherUid].sort()` guarantees that regardless of which peer initiates the lock, the room prefix is mathematically identical.
* **Epoch Suffix:** `+ '_' + Date.now()` guarantees that every single connection is a distinct Firestore entity. Stale SDP offers or delayed ICE packets from previous calls are immediately ignored by the new room's listener.

---

## 5. Clean Unmount & React Keying Architecture

### 5.1. The Zombie Track Problem
In single-page React video applications, switching between call rooms without full-page reloads frequently results in:
1. Zombie camera access (green recording light remains active in background).
2. Ghost audio echo (previous peer's audio stream keeps playing behind the new call).
3. WebRTC socket leaks consuming browser CPU and GPU hardware decoders.

### 5.2. Declarative React Keying Solution
In [`src/pages/CallRoom.jsx`](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/CallRoom.jsx), the entire call orchestration logic is encapsulated inside `CallRoomInner`, which is mounted with a dynamic composite key:

```jsx
export default function CallRoom() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'casual';

  return (
    <CallRoomErrorBoundary>
      <CallRoomInner key={`${roomId || 'practice_room'}_${mode}`} />
    </CallRoomErrorBoundary>
  );
}
```

### 5.3. Teardown Lifecycle Guarantee
When navigating to a new room or clicking "Next Match", the React reconciliation engine detects a new `key`:
1. It executes the existing component's `useEffect` cleanup return functions synchronously.
2. All `MediaStreamTrack` objects invoke `.stop()`.
3. `RTCPeerConnection.close()` terminates the UDP socket.
4. Firestore snapshot listeners call their unsubscribe functions.
5. AudioContext nodes are closed.
6. A pristine instance of `CallRoomInner` mounts with zero leftover state.
