# Forensic Architectural Audit Report & Ledger
**Project:** RandomTalks Pro  
**Auditor:** Lead Systems Architect & Forensic Code Auditor  
**Audit Scope:** Local Repository (`src/`, `docs/`, `server/`, `scripts/`, root configs)  
**Date:** October 27, 2026  
**Status:** COMPLETED & CERTIFIED  

---

## Executive Summary & Architecture Overview

RandomTalks Pro is an intent-driven, WebRTC video conferencing and discovery network built on React 18, Vite, Firebase Firestore, and Google Gemini 1.5 Flash. The system connects authenticated users in 1-on-1 and small multi-peer rooms (up to 3 peers) based on conversation purpose modes (Professional, Deep Talk, Study, Language Exchange, Gaming, Casual, Voice Only).

### Key Architectural Characteristics
- **Signaling Transport:** 100% Native WebRTC with Google STUN servers (`stun.l.google.com:19302`). SDP offer/answer exchange and ICE candidate trickle are mediated via Firestore (`/calls/{roomId}`).
- **Matchmaking Engine:** FIFO transaction-locked matching pool (`/matchQueue/{uid}`) using atomic Firestore transactions (`runTransaction`) and zero composite index requirements.
- **Client AI Intelligence:** Direct client-to-Google Gemini Flash API calls (`/v1beta/models/gemini-1.5-flash:generateContent`) for contextual icebreakers and matchmaking wait tips.
- **Rendering & UX Model:** Discord-inspired auto-packing dynamic CSS grid with Framer Motion spring physics, Web Audio API active speaker boundary detection, and Raycast/Linear tactile clay aesthetic.

---

## 1. Core Pages & Routing (`src/pages/` & `src/App.jsx`)

### 1.1 `src/App.jsx` (208 lines)
- **Role & Purpose:** Main application routing entry point, authentication route protection, deep-link persistence, and smooth scrolling setup.
- **Imports:** `Component`, `useEffect` from `react`; `BrowserRouter`, `Routes`, `Route`, `Navigate` from `react-router-dom`; `Lenis` from `@studio-freight/lenis`; `AuthProvider`, `useAuth` from `./contexts/AuthContext`; `Landing`, `ProfileSetup`, `Dashboard`, `CallRoom`; `SpotlightShell`, `FluidLoadingOrb`; icons from `lucide-react`.
- **Exported Symbols:** `default App` (L179).
- **Error Boundary (`RouteErrorBoundary`):** Class component (L17-65) catching uncaught rendering errors; displays a dark recovery UI (`bg-[#07090E]`) with "Retry Connection" (`window.location.reload()`) and "Back to Dashboard" (`window.location.href = '/dashboard'`).
- **Route Guard (`ProtectedRoute`):**
  - Reads `user` and `profile` from `useAuth()`.
  - **SPEC-003 Deep-Link Capture:** When an unauthenticated user accesses an invite link (e.g., `/call/:roomId`), the intended pathname + search is stored into `sessionStorage.getItem('rt_pending_redirect')` before redirecting to `/` (L98-102).
  - Profile completion guard: Checks `isUserSetupComplete(profile)` (defined as `isProfileComplete || setupCompleted || (username && username.trim().length > 0)`). If `requireProfile` is true and profile is incomplete, redirects to `/setup`.
- **Route Definitions in `AppRoutes`:**
  - `/` &rarr; Public landing or redirects to `authedRedirect` (`pendingRedirect` &rarr; `/dashboard` or `/setup`).
  - `/setup` &rarr; Protected by `ProtectedRoute` (`ProfileSetup`).
  - `/dashboard` &rarr; Protected by `ProtectedRoute requireProfile` (`Dashboard`).
  - `/call/:roomId` & `/room/:roomId` &rarr; Protected by `ProtectedRoute requireProfile` wrapped in `RouteErrorBoundary` (`CallRoom`).
- **Smooth Scroll (Lenis):** `useEffect` in `App` (L180-199) initializes `Lenis({ duration: 1.2, smoothWheel: true, touchMultiplier: 2 })` running in a `requestAnimationFrame` loop.

---

### 1.2 `src/pages/CallRoom.jsx` (2792 lines)
- **Role & Purpose:** Complete video/voice stage, handling WebRTC peer connections, Firestore signaling, hardware toggles, audio visualizer levels, auto-grid layout, notes scratchpad, and partner exit workflows.
- **Exports:** `default CallRoom` (L2782) wrapping `CallRoomInner` inside `CallRoomErrorBoundary`.
- **All React State Variables (27 total):**
  1. `currentRoomId` (`safeRoomId`) — active room ID string.
  2. `layoutMode` (`'grid'`) — `'grid'` | `'spotlight'`.
  3. `copiedCode` (`false`) — clipboard status for room code.
  4. `roomParticipants` (`[]`) — array of participant UIDs from Firestore call doc.
  5. `participantProfiles` (`{}`) — map of `{ [uid]: profileData }`.
  6. `localStreamState` (`null`) — reactively tracks local `MediaStream`.
  7. `remoteStreamState` (`null`) — reactively tracks remote `MediaStream`.
  8. `micVolume` (`0`) — local RMS mic level (0–100).
  9. `remoteVolume` (`0`) — remote RMS audio level (0–100).
  10. `isSearchingNext` (`false`) — boolean for auto-next matchmaking overlay.
  11. `strangerLeftOpen` (`false`) — boolean for partner disconnect prompt.
  12. `icebreaker` (`''`) — AI-generated icebreaker question.
  13. `generatingIcebreaker` (`false`) — loading state for icebreaker generation.
  14. `subtitle` (`''`) — live speech recognition text.
  15. `isRemoteConnected` (`isSoloTest`) — connection readiness flag.
  16. `otherUid` (`parseOtherUid(...)`) — opponent's UID.
  17. `otherProfile` (`null`) — opponent's user document.
  18. `chatOpen` (`false`) — text chat drawer visibility.
  19. `reportOpen` (`false`) — moderation report modal visibility.
  20. `feedbackOpen` (`false`) — post-call feedback modal visibility.
  21. `profileModalOpen` (`false`) — inspect partner profile modal visibility.
  22. `inspectingUser` (`null`) — user object being inspected.
  23. `networkingOpen` (`false`) — LinkedIn/GitHub intent exchange modal visibility.
  24. `inviteCopied` (`false`) — feedback indicator for 1-click invite link.
  25. `roomFullBlocked` (`false`) — SPEC-003 capacity modal (3/3 participants).
  26. `timeLeft` (`mode === 'quicktalk' ? 300 : null`) — 5-minute countdown timer.
  27. `callError` (`''`) — error notice string.
  28. `micEnabled` (`true`) — audio track enabled state.
  29. `isCameraOn` (`!isVoiceOnly`) — video track enabled state.
  30. `screenSharing` (`false`) — display media capture state.
  31. `notesOpen` (`false`) — session notes drawer visibility.
  32. `notes` (`''`) — quick notes scratchpad text.
  33. `saveNoteStatus` (`'idle'`) — `'idle'` | `'saving'` | `'saved'`.
- **All Ref Objects (19 total):**
  - `localVideoRef`: HTMLVideoElement for local camera preview.
  - `remoteVideoRef`: HTMLVideoElement for remote peer video.
  - `screenVideoRef`: HTMLVideoElement for screen-sharing track.
  - `localStreamRef`: Active local `MediaStream`.
  - `screenStreamRef`: Active screen-sharing `MediaStream`.
  - `remoteStreamRef`: Active remote `MediaStream`.
  - `pcRef`: `RTCPeerConnection` instance.
  - `recognitionRef`: `SpeechRecognition` instance.
  - `disconnectTimeoutRef`: Debounce timer ID (2000ms) for partner disconnect.
  - `matchPollRef`: `setInterval` ID (1500ms) for matchmaking retry.
  - `matchUnsubRef`: Unsubscribe callback for `listenForMatch`.
  - `queueUnsubRef`: Unsubscribe callback for queue listener.
  - `searchAttemptsRef`: Search retry counter.
  - `callDurationRef`: Duration counter in seconds.
  - `callTimerRef`: `setInterval` ID (1000ms) for call duration.
  - `callStartTimeRef`: Timestamp (ms) when call began.
  - `otherUidRef`: Mutable mirror of `otherUid`.
  - `otherProfileRef`: Mutable mirror of `otherProfile`.
  - `notesRef`: Mutable mirror of `notes` text.
  - `hasSavedCallRef`: Single-save guard boolean preventing duplicate history writes.
  - `isExplicitlyLeavingRef`: Disables disconnect timeout when user clicks leave.
- **Active `useEffect` Hooks (13 total):**
  1. L178-185: Synchronizes `currentRoomId` when URL param `initialRoomId` changes.
  2. L237-243: Syncs `otherUid` and `otherUidRef` when `currentRoomId` changes.
  3. L310-312: Resets `hasSavedCallRef` to `false` on room change.
  4. L315-323: Syncs mutable refs (`otherUidRef`, `otherProfileRef`, `notesRef`).
  5. L326-345: Reactive local & screen video stream assignment to `<video>` elements.
  6. L348-356: Reactive remote stream assignment to `remoteVideoRef`.
  7. L359-379: Unmount cleanup: commits call record if duration &ge; 2s.
  8. L382-388: Unmount cleanup: clears matchmaking poll & unsubscribe handlers.
  9. L391-408: Call duration interval timer (1000ms tick).
  10. L438-482: Web Audio API local mic RMS volume analyzer (fftSize: 64, smoothing: 0.4).
  11. L485-530: Web Audio API remote audio RMS volume analyzer.
  12. L783-793: Firestore listener via `listenForCallEnd(currentRoomId)` for immediate termination.
  13. L796-889: Realtime `onSnapshot` on `/calls/{currentRoomId}`: enforces 3-peer cap (SPEC-003), fetches profiles, parses `otherUid`.
  14. L892-900: QuickTalk 5-minute countdown timer.
  15. L964-1287: Complete WebRTC PeerConnection setup & Firestore signaling.
  16. L1290-1328: SpeechRecognition live mic subtitles engine.
- **WebRTC Signaling & Teardown Architecture:**
  - **ICE Servers:** Google STUN pool (`stun.l.google.com:19302`, `stun1`–`stun4`) with `iceCandidatePoolSize: 10`.
  - **Role Resolution (L1101-1122):** URL `?role=caller|callee` takes precedence, falling back to Firestore `callerUid`, then alphabetical tie-breaker on `roomId.split('_')`.
  - **ICE Trickle:** Capped at 6 candidates (`localCandidateCount < 6`) written to `/calls/{roomId}/callerCandidates` or `calleeCandidates`.
  - **Queueing Buffer (`candidateQueue`):** Holds candidates received before `remoteDescription` is set, flushed via `flushCandidates()`.
  - **Disconnection Handling:** Debounced by 2000ms (`scheduleDisconnect`) on `pc.onconnectionstatechange` / `pc.oniceconnectionstatechange` to prevent false drops on network blips.
- **SpeechRecognition Live Mic Subtitles (L1290-1328):**
  - Uses `window.SpeechRecognition || window.webkitSpeechRecognition`.
  - Sets `continuous = true`, `interimResults = true`, `lang = navigator.language || 'en-US'`.
  - Extracts latest transcript (`e.results[e.results.length - 1][0].transcript`) &rarr; `subtitle`.
  - Auto-restarts on `onend`. Cleanup unbinds `onend` and invokes `.stop()`.
  - Rendered in a fixed bottom floating pill at `bottom-24` above controls.
- **Dynamic Video Auto-Grid (SPEC-001 / B.01):**
  - `totalActivePeers`: Evaluates active count (capped at 3).
  - 1 peer &rarr; centered aspect-video; 2 peers &rarr; `grid-cols-1 md:grid-cols-2`; 3 peers &rarr; `grid-cols-2 grid-rows-2`.
  - Active speaker ring: Web Audio volume > 15 triggers `border-amber-500 ring-2 ring-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.35)]`.
- **In-Call Modals & Header Controls:**
  - Header: Mode badge, QuickTalk timer, stranger profile button, `[🔗 Invite Friend]` (writes `${origin}/call/${roomId}` to clipboard), Private room code copy.
  - Modals: `ChatPanel`, `Quick Notes` drawer, `FriendProfileModal`, `ReportModal`, `FeedbackModal`, `NetworkingModal`, `StrangerLeftModal`, `RoomFullModal`.

---

### 1.3 `src/pages/Dashboard.jsx` (1024 lines)
- **Role & Purpose:** Main application hub for purpose-based matchmaking, friend list management, incoming/outgoing calls, private room creation, and user settings.
- **All React State Variables (20 total):**
  1. `matchMode` (`profile?.preferredMode || 'professional'`) — selected discovery mode.
  2. `loungeMode` (`'focus'`) — tab filter: `'focus'` (Dev, Study, Language, DeepTalk) vs `'casual'` (QuickTalk, Gaming, Casual, VoiceOnly).
  3. `filterGender` (`'Any'`) — gender filter preference (`'Any'`, `'Male'`, `'Female'`).
  4. `searching` (`false`) — matchmaking active state.
  5. `searchStatusText` (`''`) — animated progression text.
  6. `errorMessage` (`''`) — error display string.
  7. `friends` (`[]`) — active friends with live-synced profiles.
  8. `pendingRequests` (`[]`) — incoming friend requests.
  9. `privateModalOpen` (`false`) — private code room modal visibility.
  10. `settingsOpen` (`false`) — profile settings modal visibility.
  11. `historyOpen` (`false`) — call history modal visibility.
  12. `soloTestModalOpen` (`false`) — hardware test modal visibility.
  13. `selectedProfileFriend` (`null`) — friend profile inspection target.
  14. `isProfileDrawerOpen` (`false`) — right-side profile sliding drawer.
  15. `isFriendsDrawerOpen` (`false`) — left-side friends sliding drawer.
  16. `isBanned` (`false`) — strike/ban status boolean.
  17. `dmFriend` (`null`) — friend object for active DM drawer.
  18. `incomingCall` (`null`) — incoming call invite object.
  19. `declineToast` (`null`) — toast notification when direct call is declined.
  20. `callingFriend` (`null`) — friend object for outgoing calling overlay.
  21. `unreadCounts` (`{}`) — unread message counters per friend UID.
- **Matchmaking Flow:**
  - Calls `joinQueue()` writing `/matchQueue/{uid}`.
  - Increments `searchAttemptsRef.current`:
    - Attempts 1–4: "Looking for a {Mode} partner..."
    - Attempts 5–8: "Expanding search to nearby modes..."
    - Attempts 9+: "Opening to all available strangers..."
  - Calls `tryMatch()` every 1500ms via `setInterval` + listens via `listenForMatch()`.
  - On match, navigates to `/call/${roomId}?mode=${mode}&role=caller|callee`.
- **Drawer Architecture:**
  - **Left Sliding Drawer:** Friends list, pending requests accept/reject, direct call trigger, DM trigger.
  - **Right Sliding Drawer:** User trust score, country, profession, quick links to Solo Test, History, Settings, and Sign Out.

---

### 1.4 `src/pages/Landing.jsx` (210 lines) & `src/pages/ProfileSetup.jsx` (236 lines)
- **`Landing.jsx`:**
  - Modes: `'signin'`, `'signup'`, `'forgot'`.
  - Pure Firebase Email/Password auth (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendPasswordResetEmail`).
  - **Forensic Note on Google OAuth:** Google OAuth is **not implemented** in `Landing.jsx`. Authentication relies entirely on email and password.
  - Displays password validation (&ge; 6 chars) and translates Firebase error codes into friendly UI notices.
- **`ProfileSetup.jsx`:**
  - Enforces trust-first onboarding: Username, Occupation, Age (&ge; 18 mandatory), Gender, Country, Language, Key Topics (interests tags, up to 5), Camera Default preference.
  - Checkbox verification for community guidelines and 18+ age confirmation.
  - **Forensic Note on Avatars:** There is **no photo upload or image picker**; avatars are dynamically generated in UI from user initials inside circular gradient containers (`profile.username.charAt(0).toUpperCase()`).
  - Calls `updateProfile()` writing initial Firestore user doc with `isAdult: true`, `isVerified: true`, `isProfileComplete: true`, `setupCompleted: true`, `trustScore: 100`, `strikeCount: 0`.

---

## 2. In-Call & Global Modals (`src/components/`)

| Component | Lines | Key State & Refs | Primary Operations & Triggers |
|---|---|---|---|
| **`ConnectionLoader.jsx`** | 139 | `tips` (fallback tips array), `currentTipIndex` (0), `fade` (bool) | Displays matchmaking GIF and cycles tips every 3500ms. Calls `generateMatchmakingTips()` from `geminiIcebreaker.js`. Triggers `onCancel`. |
| **`CallHistoryModal.jsx`** | 274 | `history` ([]), `loading` (bool), `expandedNotes` ({}), `inspectingStranger` (null) | Fetches past 5 days of session history via `getRecentCallHistory(user.uid, 5)`. Supports inline notes expansion and inspection of stranger profile via `FriendProfileModal`. |
| **`ChatPanel.jsx`** | 130 | `messages` ([]), `text` (''), `bottomRef` | Realtime `onSnapshot` listener on `/calls/{roomId}/messages` (ordered by `createdAt asc`, limit 200). Truncates messages to 500 chars. Auto-scrolls to `bottomRef`. |
| **`FriendProfileModal.jsx`** | 243 | `profile`, `loading`, `friendStatus` ('none'\|'pending'\|'friend') | Reads public user document (`/users/{targetUid}`). Checks friendship/pending status via `checkIsFriend` & `checkPendingRequest`. Triggers `sendFriendRequest`. |
| **`DmDrawer.jsx`** | 126 | `messages` ([]), `text` (''), `sending` (bool), `bottomRef` | 1-on-1 private messaging using `listenToDm` and `sendDm`. Enforces 5-day retention window filter (`isWithinRetention`). Bottom-right fixed docking. |
| **`SoloTestModal.jsx`** | 408 | `localStream`, `isCameraOn`, `isMicOn`, `micVolume`, `audioContextRef`, `animFrameRef` | Acquires hardware streams (`getUserMedia`), provides video/audio fallback ladder, and renders live volume meter using Web Audio `AnalyserNode` in a `requestAnimationFrame` loop. |
| **`SettingsModal.jsx`** | 320 | `formData` (profile clone), `saving`, `saved`, `error` | Form for updating username, occupation, age, country, language, interests (max 5 tags), camera default, LinkedIn, GitHub. Persists via `updateProfile()`. |
| **`PrivateRoomModal.jsx`** | 235 | `tab` ('create'\|'join'), `generatedCode`, `inputCode`, `copiedTarget` | Generates 6-digit random code, writes `/privateRooms/{code}` and creates `/calls/private_{code}`. Verifies code existence on join and navigates to `/call/private_{code}?mode=group`. |
| **`IncomingCallModal.jsx`** | 114 | `accepting`, `declining`, `audioRef` (Audio chime) | Plays looping audio chime (`CHIME_URL`). Calls `ensureCallRoom` and `acceptCallInvite` on accept, navigating to `/call/${invite.roomId}?mode=direct`. |
| **`CallingOverlay.jsx`** | 54 | `dots` (cycled string) | Full-screen pulsing caller overlay showing target friend's name and dot animation (500ms interval) while awaiting response. |
| **`FeedbackModal.jsx`** | 66 | `submitted` (bool) | Post-call rating trigger: 'Great' (thumbs up), 'Mismatch' (frown), 'Spam' (flag). Submits payload to `/feedback` collection via `submitPostChatFeedback`. |
| **`ReportModal.jsx`** | 78 | `reason` ('Spam', 'Harassment', etc.), `details`, `alsoBlock` (bool) | Dispatches `onSubmit({ reason, details, alsoBlock })` to report and optionally block user via `reportUser` and `blockUser`. |
| **`NetworkingModal.jsx`** | 158 | `myShared`, `otherShared`, `otherData`, `countdown` (20s) | Mutual contact exchange during call exit. Listens on `/networkExchanges/{roomId}/intents/{otherUid}` and writes own intent with LinkedIn/GitHub URLs. |
| **`SpotlightShell.jsx`** | 43 | `shellRef` (DOM node) | Tracks mouse coordinates via `pointermove` and lerp interpolation in `requestAnimationFrame`, updating CSS variables `--mouse-x` and `--mouse-y` for radial ambient glow. |
| **`FluidLoadingOrb.jsx`** | 29 | `messageIndex` (cycles 2 messages) | Initial app loading indicator with morphing fluid gradient orb animated via `@keyframes fluidOrbMorph`. |

---

## 3. Data Layer, Utilities & State Management (`src/lib/`, `src/contexts/`, `src/config/`)

### 3.1 `src/contexts/AuthContext.jsx` (114 lines)
- **Auth Observer:** Listens to `onAuthStateChanged(auth, ...)`.
- **Live Profile Synchronization:** On auth resolution, attaches real-time `onSnapshot(doc(db, 'users', currentUser.uid))` listener. Evaluates `isUserSetupComplete` and updates state in real-time across all browser tabs.
- **Exported APIs:** `signUp`, `signIn`, `logout`, `sendPasswordReset`, `updateProfile`, `user`, `profile`, `loading`.
- **Render Guard:** Line 108: `{!loading && children}` prevents child tree evaluation before authentication state settles.

### 3.2 Firebase Config & Redundancies
- **`src/config/firebase.js` (19 lines):** Primary initialization using `initializeApp`, `getAuth`, `getFirestore`. Config values sourced from `import.meta.env.VITE_FIREBASE_*`.
- **`src/lib/firebase.js` (1 line):** Redundant re-export: `export { auth, db } from '../config/firebase';`. Candidate for consolidation.

### 3.3 `src/lib/matchmaking.js` (334 lines)
- **`joinQueue({ uid, username, ... })`:** Writes `/matchQueue/{uid}` with `status: 'waiting'`, `roomId: null`, `joinedAt: serverTimestamp()`.
- **`leaveQueue(uid)`:** Deletes `/matchQueue/{uid}`.
- **`tryMatch(uid, options)`:**
  - Queries `where('status', '==', 'waiting')` with `limit(80)`.
  - Filters out self (with localhost exception for dual-window testing).
  - In-memory FIFO sort by `joinedAt`.
  - Evaluates mode compatibility: `voiceonly` is strictly isolated; non-voice modes expand dynamically across attempt tiers.
  - Evaluates mutual gender filters.
- **`attemptLock(myUid, otherUid)`:**
  - Atomic room pairing executed inside Firestore `runTransaction(db, async (tx) => ...)`.
  - Verifies both participant documents still have `status == 'waiting'`.
  - Updates both documents to `status: 'matched'` with `roomId` and `matchedWith`.
  - Atomically creates `/calls/{roomId}` with `participants: [myUid, otherUid]`, `callerUid: myUid`, `status: 'active'`, `isEnded: false`.
- **`listenForMatch(uid, onMatched, onError, onQueueActivity)`:** Dual listener observing both own queue document and waiting pool activity.

### 3.4 Direct Calls & Messaging (`directCalls.js` & `dm.js`)
- **`src/lib/directCalls.js` (101 lines):**
  - `sendCallInvite`: Writes `/callInvites/{receiverUid}` with `status: 'pending'`, `roomId`.
  - `acceptCallInvite`: Deletes invite document.
  - `declineCallInvite`: Updates invite document to `status: 'declined'`.
  - `listenForCallResponse`: Observes `/callInvites/{receiverUid}` for decline or deletion ('gone').
  - `listenForIncomingCall`: Realtime listener for incoming invitations.
- **`src/lib/dm.js` (104 lines):**
  - `dmRoomId(uid1, uid2)`: Deterministic room key `[uid1, uid2].sort().join('_dm_')`.
  - `sendDm`: Upserts parent `/dms/{roomId}` with participants array, adds message to subcollection `/dms/{roomId}/messages`.
  - `isWithinRetention`: Validates message `createdAt` against strict 5-day retention window (`5 * 24 * 60 * 60 * 1000`).

### 3.5 Friends & Call History (`friends.js` & `callHistory.js`)
- **`src/lib/friends.js` (185 lines):**
  - Friend requests stored in `/friendRequests/{fromUid}_{toUid}`.
  - Acceptance creates `/friends/{fid}` (`fid = [uid1, uid2].sort().join('_')`).
  - `listenToFriends`: Listens to `/friends` with `array-contains`, then dynamically binds individual `onSnapshot` listeners to each friend's user document (`/users/{friendUid}`) for real-time name and status updates.
- **`src/lib/callHistory.js` (171 lines):**
  - Writes records to `/call_history/{userId}_{roomId}` with `duration`, `notes`, `mode`, `timestamp`.
  - Guard: Ignores sessions with duration < 2 seconds.
  - `getRecentCallHistory`: Single-field query `where('userId', '==', userId)`, filtered in-memory for 5-day retention threshold.

### 3.6 AI Engines & Moderation (`gemini.js`, `geminiIcebreaker.js`, `moderation.js`)
- **`src/lib/gemini.js` (141 lines):**
  - Direct HTTP fetch to Gemini 1.5 Flash endpoint (`generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=...`).
  - `generateIcebreaker`: Generates 1 targeted question (&le; 20 words) based on matched user interests and room mode.
  - `generateMatchmakingTips`: Generates 5 JSON tips with emojis.
  - Includes comprehensive offline fallback dictionaries (`FALLBACK_ICEBREAKERS` per mode, `FALLBACK_TIPS`).
- **`src/lib/geminiIcebreaker.js` (4 lines):** Redundant re-export of `gemini.js`.
- **`src/lib/moderation.js` (132 lines):**
  - `blockUser`: Writes `/blocks/{blockerUid}_{blockedUid}`.
  - `checkIsBanned`: Checks user document `isBanned` flag or `strikeCount >= 3`.
  - `reportUser`: Writes deduplicated report document to `/reports/{reporterUid}_{reportedUid}_{roomId}` with status `'open'`. Client-side rules prevent client modification of strikes.
  - `submitPostChatFeedback`: Writes rating records to `/feedback`.

### 3.7 Animation & Styling (`motion.js`, `App.css`, `index.css`)
- **`src/lib/motion.js` (48 lines):** Exports Law 31 compliant spring configurations (`springTransition`: stiffness 380, damping 30; `snappySpring`: stiffness 450, damping 25), modal and drawer variants, and `triggerCelebrationConfetti()`.
- **`src/App.css` (184 lines):** Residual default Vite starter CSS. **Not imported anywhere in `src/`**.
- **`src/index.css` (233 lines):** Core application stylesheet defining design tokens, Lenis smooth scroll overrides, fluid orb animations, Raycast halo utilities, and ZegoCloud UI suppression overrides.

---

## 4. Security Rules, Documentation & Legacy Files

### 4.1 `firestore.rules` (126 lines) & `firestore.indexes.json`
- **Security Rules Audit:**
  - `/users/{uid}`: Authenticated read; owner create/update; **prevents client modification of `isBanned` and `strikeCount`**.
  - `/matchQueue/{uid}`: Read/write locked strictly to `isOwner(uid)`.
  - `/call_history/{recordId}`: Read/write restricted to `userId == request.auth.uid`.
  - `/reports/{reportId}` & `/feedback/{feedbackId}`: Create-only by verified sender; read/update/delete denied.
  - `/blocks/{blockId}`, `/friends/{fid}`, `/friendRequests/{reqId}`, `/callInvites/{uid}`: Correctly scoped to involved parties.
- **Critical Architectural Security Friction Point:**
  - In `firestore.rules` lines 36–39:
    ```javascript
    match /calls/{roomId} {
      allow create: if isAuthenticated() && request.auth.uid in request.resource.data.participants;
      allow read, update: if isAuthenticated() && request.auth.uid in resource.data.participants;
      allow delete: if false;
    ```
  - **Identified Issue:** When an invited third peer accesses a dynamic invite link (`/call/:roomId` per SPEC-003) or joins via `PrivateRoomModal.jsx`, their UID is **not yet in `resource.data.participants`**. Consequently, their initial `onSnapshot` read and `arrayUnion` update to join the call will be **blocked by Firestore security rules with `PERMISSION_DENIED`**.
  - **Remedy:** Update call document update rule to allow authenticated users to add themselves if `resource.data.participants.size() < 3`.

### 4.2 Documentation Inventory (`docs/` & `docs/specs/`)
- `1_PROJECT_VISION.md`: Vision charter, verified stranger networking thesis, trust score principles.
- `2_ARCHITECTURE.md`: Technical infrastructure specification, native WebRTC signaling, zero-cost architecture.
- `3_DISCORD_CALL_SPEC.md`: Dynamic grid canvas specifications, speaker detection criteria, fluid UI rules.
- `4_SDD_WORKFLOW.md`: Spec-Driven Development protocol and commit governance.
- `5_DATA_MODELS.md`: Comprehensive Firestore schemas, retention policies, and query invariants.
- `6_SECURITY_MODERATION.md`: Trust scoring, strike thresholds, server-side moderation invariants.
- `7_MASTER_CHECKLIST.md`: Feature verification ledger tracking 59 capabilities across Phases 1–3.
- `8_PHASE_ROADMAP.md`: Long-term evolutionary roadmap from 2026 to 2028.
- `SPEC-001_DISCORD_AUTO_GRID.md`: Specification for dynamic auto-grid and speaker border glow.
- `SPEC-002_REMATCH_CAMERA_AND_UI_STABILIZATION.md`: Rematch camera pipeline and disconnect dialog specifications.
- `SPEC-003_DIRECT_FRIEND_INVITE_AND_ROOM_CAP.md`: Dynamic invite link generation, 3-peer capacity cap, and deep-link routing.

### 4.3 Legacy & Candidate Decommissioning Files (`server/` & `scripts/`)
- **`server/` Directory (5 files):**
  - `server/index.js`, `server/lib/zegoServerAssistant.js`, `server/package.json`, `server/README.md`, `server/.env.example`.
  - **Forensic Verification:** An exhaustive grep across `src/` reveals **zero imports or network references** to `server/` or port `3001`. The codebase has fully migrated to Native WebRTC and client-side Gemini Flash.
  - **Recommendation:** `server/` is completely dormant and safe for decommissioning/removal.
  - **`package.json` Dependency:** `@zegocloud/zego-uikit-prebuilt` is retained in `package.json` dependencies but is never imported in `src/`. It can be safely uninstalled.
- **`scripts/` Directory (6 files):**
  - Contains test automation scripts (`interactive-two-window-test.mjs`, `verify-history-modal.mjs`, `verify-live.mjs`) and UI snapshot artifacts. None are imported by `src/`. They serve as standalone QA verification harnesses.
- **Root Configurations:**
  - `skills-lock.json`: Locks 12 agent skills from `firebase/agent-skills` (Firestore, Auth, App Hosting, Security Rules Auditor, etc.).
  - `tailwind.config.js`: Custom colors (`primary: '#FCA311'`, `navy: '#14213D'`), fonts (`Plus Jakarta Sans`, `JetBrains Mono`), and spring transition easing curves.
  - `vite.config.js`: Clean React plugin integration (`@vitejs/plugin-react`).

---

## 5. Master Friction Points & Architectural Recommendations

| Priority | Area | Issue Description | Recommended Resolution |
|---|---|---|---|
| **P1** | **Firestore Rules** | `/calls/{roomId}` update rule blocks invited third peers from adding their UID to `participants` via invite link. | Update rule: `allow update: if isAuthenticated() && (request.auth.uid in resource.data.participants \|\| (resource.data.participants.size() < 3 && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participants'])));` |
| **P2** | **Dependencies** | `@zegocloud/zego-uikit-prebuilt` is installed in `package.json` (~25MB bundle weight) but completely unused in `src/`. | Run `pnpm remove @zegocloud/zego-uikit-prebuilt` to trim bundle footprint. |
| **P3** | **Legacy Server** | `server/` directory is obsolete following the migration to native WebRTC and Gemini Flash. | Archive or delete `server/` directory. |
| **P4** | **Re-exports** | `src/lib/firebase.js` and `src/lib/geminiIcebreaker.js` are redundant single-line re-exports. | Point imports directly to `src/config/firebase.js` and `src/lib/gemini.js`, then deprecate wrappers. |
| **P5** | **Environment Docs** | `VITE_GEMINI_API_KEY` is required in `src/lib/gemini.js` but missing from `.env.example`. | Add `VITE_GEMINI_API_KEY=` to `.env.example`. |
| **P6** | **Unused CSS** | `src/App.css` is leftover boilerplate from the Vite template. | Delete `src/App.css`. |

---
*Report certified by Lead Systems Architect & Forensic Code Auditor on October 27, 2026.*

