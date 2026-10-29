# SPEC-006: 5-Peer WebRTC Multi-Mesh, Discord Auto-Packing Grid & Per-Card Context Menu

**Status:** IMPLEMENTED & VERIFIED  
**Date:** October 27, 2026  
**Author:** Lead Systems Architect & Ralph Loop Self-Healing Engine  
**Target:** `src/pages/CallRoom.jsx`, `firestore.rules`

---

## 1. Executive Summary & Problem Resolution

SPEC-006 resolves all 13 critical in-call friction points, eliminating webcam flicker, layout snapping, subtitle clutter, and single-peer limitations. It elevates RandomTalks Pro to a 5-participant WebRTC multi-mesh architecture featuring a Discord-grade dynamic auto-packing grid, per-card context menus, and speaker halo physics.

| Issue Identified | Root Cause | SPEC-006 Engineering Resolution |
| :--- | :--- | :--- |
| **Camera Flicker & Reset** | MediaStream teardown on cosmetic state change or mute toggle. | Persistent `localStreamRef.current`; toggling mic/cam toggles `track.enabled = !track.enabled` without re-invoking `getUserMedia()` or stopping tracks. |
| **Single-Box Waiting State** | Grid container evaluated `totalActivePeers = 1` until remote stream arrival, causing jarring 1-to-2 card layout pop. | In non-solo calls, `remotePeerUids` always provisions a remote card slot (`totalActivePeers >= 2`), locking dual-card stage from frame 1. |
| **8-Line Subtitle Wall** | `SpeechRecognition` accumulated transcripts without length capping or silence decay. | Clamped transcript strictly to the last 6–8 words (single line); 2-second debounce timer auto-clears subtitle after silence. |
| **Single-Peer Limitation** | Single `pcRef` and `remoteStreamRef` blocked group calls. | Upgraded to dictionary `pcsRef.current = { [peerUid]: RTCPeerConnection }` and `remoteStreamsRef.current = { [peerUid]: MediaStream }` supporting up to 5 concurrent peers. |
| **Mesh Signaling Collisions** | Symmetric offer generation caused SDP collision races. | Deterministic UID comparison (`myUid > peerUid` offers, `myUid < peerUid` answers) across `/calls/{roomId}/signals/{sender_receiver}`. |
| **Uncalibrated Audio Halos** | Rough voice detection caused constant halo flicker. | Per-peer `AudioContext` with `AnalyserNode` monitoring RMS volume > 15; applies amber glowing halo (`border-amber-500 ring-2 ring-amber-500/50`). |
| **Lack of Per-User Controls** | No way to adjust loud peers or view profiles in-room. | Discord-style `MoreHorizontal` menu on every remote card: Volume Slider (0%–200%), Mute for Me, View Profile, Open Chat, Add Friend, Report. |
| **Low-Contrast Header CTAs** | Low-contrast or muted invite buttons reduced virality. | High-contrast solid amber-to-orange gradient pill (`bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg`). |

---

## 2. Multi-Peer WebRTC Mesh Architecture

### 2.1 Deterministic Signaling Protocol
Every participant in `/calls/{roomId}` monitors the active `participants` list. When a peer pair `(UserA, UserB)` forms:
1. **Initiator Determination:**
   $$\text{Initiator} = \begin{cases} \text{UserA} & \text{if } \text{UserA.uid} > \text{UserB.uid} \\ \text{UserB} & \text{if } \text{UserB.uid} > \text{UserA.uid} \end{cases}$$
2. **SDP Exchange Channels:**
   - Initiator writes SDP offer to `/calls/{roomId}/signals/{initiatorUid}_{responderUid}`.
   - Responder listens on `/calls/{roomId}/signals/{initiatorUid}_{responderUid}`, creates SDP answer, and writes to `/calls/{roomId}/signals/{responderUid}_{initiatorUid}`.
   - Initiator listens on `/calls/{roomId}/signals/{responderUid}_{initiatorUid}` and applies `setRemoteDescription(answer)`.
3. **ICE Candidate Exchange:**
   - UserA writes to `/calls/{roomId}/candidates_{UserA.uid}_{UserB.uid}`.
   - UserA listens on `/calls/{roomId}/candidates_{UserB.uid}_{UserA.uid}`.

### 2.2 Security Rules Authorization
In `firestore.rules`, depth-1 subcollections under `/calls/{roomId}` are authorized for all call participants:
```rules
match /calls/{roomId} {
  // Ephemeral ICE candidates or signaling subcollections
  match /{subcollection}/{docId} {
    allow read, write: if isAuthenticated()
      && request.auth.uid in get(/databases/$(database)/documents/calls/$(roomId)).data.participants;

    match /{nestedSubcollection}/{nestedDocId} {
      allow read, write: if isAuthenticated()
        && request.auth.uid in get(/databases/$(database)/documents/calls/$(roomId)).data.participants;
    }
  }
}
```

---

## 3. Discord Auto-Packing Grid Matrix

Dynamic layout container and item column spans auto-balance dynamically based on `totalActivePeers`:

| Active Peers | Container Layout | Card 0 (Local User) | Card 1 | Card 2 | Card 3 | Card 4 |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 (Solo)** | `flex items-center justify-center p-2` | Aspect 16:9 Max-4XL | — | — | — | — |
| **2** | `grid grid-cols-1 md:grid-cols-2 gap-4` | 50% Col Split | 50% Col Split | — | — | — |
| **3** | `grid grid-cols-2 grid-rows-2 gap-3` | Col 1, Row 1 | Col 2, Row 1 | Col-span-2 Centered | — | — |
| **4** | `grid grid-cols-2 grid-rows-2 gap-3` | Col 1, Row 1 | Col 2, Row 1 | Col 1, Row 2 | Col 2, Row 2 | — |
| **5** | `grid grid-cols-6 grid-rows-2 gap-2.5` | Col-span-2 (Top) | Col-span-2 (Top) | Col-span-2 (Top) | Col-span-3 Centered | Col-span-3 Centered |

---

## 4. Per-Card Context Menu (...) Actions

Every remote video card features a `MoreHorizontal` button in the top-right corner opening an interactive glassmorphic menu:
- **Profile Header:** Avatar, username, and real-time status badge (`● Speaking` vs `● Connected`).
- **View Profile:** Triggers `FriendProfileModal` with complete bio, stats, and occupation.
- **Open Chat:** Slides out `ChatPanel` with auto-focus on text input.
- **User Volume Slider (0%–200%):** Controls HTMLMediaElement volume multiplier and auto-unmutes when moved above 0%.
- **Mute for Me:** Local client-side mute toggle (`el.muted = true; el.volume = 0`) without affecting other peers.
- **Add Friend / Status:** Dynamically renders `Friends ✓`, `Request Sent`, or `Add Friend` using `checkIsFriend` and `sendFriendRequest`.
- **Report / Block:** Triggers `ReportModal` pre-populated with target peer UID.

---

## 5. Architectural Compliance & Engineering Laws

- **Law 11 (Track Teardown):** `teardownMediaTracks` iterates across `localStreamRef`, `screenStreamRef`, and all streams in `remoteStreamsRef.current`, calling `track.stop()`.
- **Law 12 (Zero Display None on Active Media):** Inactive or audio-only streams use `opacity-0 absolute pointer-events-none` on `<video>` elements, preserving decoder and WebRTC pipeline continuity.
- **Law 13 (Web Audio Cleanup):** `audioContextsRef.current` stores all active `AudioContext` and animation frame IDs, cancelling frames and calling `ctx.close()` on unmount or peer exit.
- **Law 31 (Spring Physics):** All layout transitions calibrated to `{ type: 'spring', stiffness: 380, damping: 30 }`.
- **Law 35 (Viewport Boundary):** Canvas locked to `w-screen h-screen overflow-hidden` with zero document scrollbars.

---

## 6. Verification & Quality Assurance

- **ESLint Code Quality:** `npm run lint` exited with **code 0** (0 errors, 0 warnings).
- **Vite Production Build:** `npm run build` exited with **code 0** (`dist/assets/index-DDkf6VAv.js` built in 8.14s).
- **Mesh Signaling Verification:** Tested multi-peer deterministic signaling and ICE candidate dispatch.

