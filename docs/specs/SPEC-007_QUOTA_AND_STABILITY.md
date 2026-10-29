# SPEC-007: Quota Optimization, Mobile Responsiveness, Route Stabilization & Universal In-Call Controls

## Executive Architectural Summary
**Specification ID:** SPEC-007  
**Module Target:** `random_talks` (Frontend WebRTC & Firestore Real-Time Data Layer)  
**Status:** Complete & Verified (`exit code 0` on `npm run lint` and `npm run build`)  
**Lead Systems Architect:** Antigravity Principal Systems Architect  

SPEC-007 permanently eliminates the 46,000+ daily Firestore read quota spike caused by legacy high-frequency polling, hardens route history to eliminate ghost call sessions, establishes universal invite controls across all room modalities (including Solo Practice), fine-tunes mobile responsiveness for modern handheld viewports (e.g., iPhone 16 Pro, 393px width), and resolves in-call modal z-index collisions.

---

## 1. Forensic Root Cause Analysis: The 46K Firestore Read Quota Spike

### The Problem
During earlier development, users in the matchmaking queue triggered an aggressive polling interval:
```javascript
// LEGACY DEFECT (Dashboard.jsx & CallRoom.jsx):
pollRef.current = setInterval(attempt, 1500);
```
In each attempt, `tryMatch` queried `/matchQueue` with `limit(80)` documents. At a 1.5-second frequency:
$$\frac{60\text{ seconds}}{1.5\text{ seconds}} \times 80\text{ documents} = 3,200\text{ document reads per minute per user}$$
A single developer testing matchmaking for just 15 minutes generated:
$$15 \times 3,200 = 48,000\text{ document reads}$$
This instantly exhausted the daily Google Cloud Firestore free-tier quota (50,000 reads/day) and triggered `RESOURCE_EXHAUSTED` / `permission-denied` errors.

### The Phased Quota Fix
1. **Purged 1.5s Polling:** Completely eradicated `setInterval(attempt, 1500)` from both [Dashboard.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/Dashboard.jsx) and [CallRoom.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/CallRoom.jsx).
2. **Event-Driven Matching via Firestore Listeners:** Refactored matchmaking to rely on active `onSnapshot` listeners:
   - User ticket listener on `/matchQueue/{uid}` (`status: 'matched'`).
   - Waiting pool listener on `/matchQueue` with `limit(20)`.
3. **Throttled & Debounced Matching Engine:** Candidate matching (`tryMatch`) now executes strictly when queue documents change, enforced by a minimum 2,500ms debounce guard.
4. **Slow Watchdog Fallback (10 Seconds):** Replaced 1.5s polling with a 10-second safety watchdog fallback (`setInterval(attempt, 10000)`).
5. **Batch Query Limit Reduction:** Reduced Firestore query limits from 80 to 20 documents in [matchmaking.js](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/lib/matchmaking.js) across `tryMatch`, `listenForMatch`, and `listenToWaitingQueue`, achieving a **75% reduction in read consumption per query**.

---

## 2. Universal [🔗 Invite Friend] Pill & Solo-to-Mesh Transition

### Universal Header Pill
The high-contrast amber invite pill button `[🔗 Invite Friend]` is unconditionally rendered in the top header of [CallRoom.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/CallRoom.jsx) across all operational modes:
- **Solo Practice Mode**
- **Matchmaking Rooms**
- **Casual Lounge**
- **Group Mesh Pods**

### Frictionless Room Provisioning on Copy
Clicking the invite button in a Solo Practice room copies the shareable URL `${window.location.origin}/call/${currentRoomId}` and invokes `ensureCallRoom(currentRoomId, [user.uid], { isPractice: true, createdBy: user.uid })`. This provisions the Firestore room document on-demand, ensuring that incoming peers who receive the link do not trip permission rejections or missing-document errors.

### Dynamic Solo-to-Mesh Transition
`isSoloTest` is now evaluated dynamically against active room participants:
```javascript
const isSoloTest = Boolean(
  (safeRoomId.startsWith('practice_') ||
    safeRoomId.startsWith('solo_') ||
    mode === 'practice' ||
    mode === 'solo') &&
    roomParticipants.length <= 1
);
```
When an invited friend joins a solo practice session, `roomParticipants.length` becomes 2, immediately transitioning the room into a live 2-peer WebRTC mesh call without requiring the host to restart or re-enter.

---

## 3. Route Stabilization & Ghost Call Elimination

### History Replacement Navigation
To prevent back-button loops between call rooms and matchmaking queues, all navigations into calls now enforce `{ replace: true }`:
- `goToRoom(roomId, role)` -> `navigate(`/call/${roomId}?mode=${matchMode}${roleQuery}`, { replace: true })`
- `startPracticeCall()` -> `navigate(`/call/${roomId}?mode=practice`, { replace: true })`
- `startDirectCall(friend)` -> `navigate(`/call/${roomId}?mode=direct`, { replace: true })`
- `handleNextStranger()` -> `navigate(`/call/${matchedRoom}?mode=${mode}&role=caller`, { replace: true })`

### Browser Back Button (`popstate`) Trapping
In [Dashboard.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/Dashboard.jsx), a window `popstate` event listener detects browser back navigation during active matchmaking and triggers `stopSearching(true)`, immediately clearing interval timers, disconnecting real-time listeners, and removing the user's ticket from `/matchQueue`.

---

## 4. Mobile Responsiveness for ConnectionLoader (iPhone 16 Pro / 393px)

In [ConnectionLoader.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/components/ConnectionLoader.jsx):
1. **Responsive Hand Scaling:** Replaced hardcoded inline `scale(1.35)` with responsive Tailwind classes:
   `scale-[0.85] sm:scale-100 md:scale-125 max-w-xs sm:max-w-md md:max-w-5xl`.
2. **Adaptive Vertical Offsets:** Replaced static `-100px` Y-transform with responsive translation:
   `-translate-y-12 sm:-translate-y-20 md:-translate-y-24`.
3. **Open-Space Text Placement:** Positioned the overlay text block at `translate-y-16 sm:translate-y-24 md:translate-y-28` with `max-w-xs sm:max-w-lg md:max-w-2xl` to eliminate overlapping or clipping on 393px viewports.
4. **Touch-Friendly CTA:** Formatted the "Leave Queue" button with `touch-manipulation`, active scale feedback, and bottom anchor `bottom-6 sm:bottom-8`.

---

## 5. In-Call Context Menu & Z-Index Collision Elimination

1. **Z-Index Layer Elevation:** Upgraded [ChatPanel.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/components/ChatPanel.jsx) container from `z-20` to `z-50` (`fixed sm:absolute z-50`), ensuring the chat drawer always layers cleanly above video cards (`z-10`), name badges (`z-20`), and card menus (`z-30`/`z-40`).
2. **Click-Outside Dismiss Backdrop:** Added an invisible backdrop `<div className="fixed inset-0 z-30" onClick={() => setCardMenuOpenUid(null)} />` whenever a remote peer's 3-dot context menu is opened.
3. **Auto-Close on Action:** Clicking any option ("Mute for Me", "Add Friend", "Open Chat", "View Profile", or "Report / Block") instantly closes the menu (`setCardMenuOpenUid(null)`).
4. **Drawer Mutual Exclusion:** Opening the chat drawer automatically dismisses any open card context menus and quick notes.

---

## 6. Ralph Loop Closed-Loop Verification

| Check | Tool / Command | Exit Code | Result |
| :--- | :--- | :--- | :--- |
| **ESLint Validation** | `npm run lint` | `0` | Clean — 0 errors, 0 warnings across all files |
| **Vite Production Build** | `npm run build` | `0` | Built in 33.49s — bundle generated successfully at `dist/` |
| **TypeScript / JSX Syntax** | Vite compiler | `0` | Verified valid syntax, ref bindings, and dependencies |

---
*Generated by Antigravity Principal Systems Architect under Ralph Loop Autonomous Verification on October 28, 2026.*

