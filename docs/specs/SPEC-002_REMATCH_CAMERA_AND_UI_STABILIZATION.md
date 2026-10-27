# SPEC-002: Rematch State Reset, Single-State Camera Pipeline & UI Ergonomics Stabilization

> **Feature ID:** `SPEC-002` (Roadmap: `B.02` & `B.03`)  
> **Target Components:**  
> - `src/pages/CallRoom.jsx`  
> - `src/pages/Dashboard.jsx`  
> - `src/components/FriendProfileModal.jsx`  
> - `src/components/SoloTestModal.jsx`  
> - `src/components/WingmanHubModal.jsx`  
> **Status:** Approved Architectural Specification  
> **Author:** Antigravity Engineering  
> **Enforcement:** `.antigravity/rules.md` (Laws 11, 12, 14, 31, 33, 34, 36)  
> **Last Updated:** 2026-10-20  

---

## 1. Executive Summary & Root Causes

During multi-peer video testing and binge matchmaking, three critical friction points were identified:
1. **Rematch State Hang:** During stranger auto-next or re-matching, `isSearchingNext` remained locked in `true` if the URL `roomId` parameter transitioned while an async Firestore transaction was mid-flight. This caused the matchmaking loader or status pill to obscure the new call room.
2. **Camera Multi-State Desynchronization:** Camera availability was fragmented across three competing states: `camEnabled`, `isLocalVideoActive`, and `isCameraOn`. Furthermore, using CSS `hidden` / `display: none` violated Law 12 and triggered Chromium track freeze bugs.
3. **Ergonomic Clutter & Drawer Inconsistency:**
   - The top-right CallRoom header was burdened with a redundant `+ Add Friend` button that collided with stranger privacy and duplicated modal actions.
   - The Dashboard lacked a dedicated `[⚡ Add Wingman]` launcher.
   - Friends and user profile drawers were entangled into a single drawer rather than having a dedicated left slide-out for Friends/DMs and a dedicated right slide-out for User Profile.

---

## 2. Technical Architecture & Invariant Specifications

### 2.1 Rematch State Synchronization Protocol
* **Invariant:** Under no circumstances may `isSearchingNext` remain `true` once a room has mounted or the URL `roomId` parameter has resolved.
* **Mechanism:**
  - In `CallRoom.jsx`, when `initialRoomId` changes or is mounted, invoke:
    ```javascript
    setIsSearchingNext(false);
    setStrangerLeftOpen(false);
    ```
  - Both caller and callee match resolution handlers (`tryMatch` and `listenForMatch`) must synchronously clear `isSearchingNext(false)` prior to navigation.
  - Active call stage renders the live peer canvas with zero residual loader artifacts.

### 2.2 Single-State Camera Pipeline (Law 12 Enforcement)
* **Invariant:** Video track visibility must be represented by a **single boolean flag**: `isCameraOn` (defaulting to `true` for all video modes).
* **Elimination of Deprecated State:**
  - Completely purge `camEnabled` and `isLocalVideoActive`.
  - In `initMedia` / `initDeviceTest`, acquire media via `{ video: true, audio: true }`.
  - Direct binding:
    ```javascript
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
    ```
  - **No `display: none`:** `<video>` elements remain permanently mounted in the DOM. Video muting is toggled using `opacity-100` vs `opacity-0 absolute pointer-events-none` with an elevated clay avatar overlay.

### 2.3 Header & Modal Ergonomics Polish
* **CallRoom Header:**
  - Remove `+ Add Friend` from the top-right header tray.
  - Introduce sleek `[⚡ Add Wingman]` button trigger: opens `WingmanHubModal`.
* **FriendProfileModal:**
  - Relocate the primary `[➕ Send Friend Request]` (or `[✓ Friends]`, `[✓ Sent]`) action button to the bottom of the profile details card as a full-width prominent pill.
* **Dashboard Left Capsule Dock:**
  - Floating vertical notch dock (`fixed left-4 top-1/2 -translate-y-1/2 w-[78px]`) with high-contrast `#F8FAFC` icons and dedicated micro-labels:
    1. Compass ──► `Home`
    2. Users ──► `Friends`
    3. Key ──► `Private Room`
    4. Clock ──► `History`
    5. Settings ──► `Settings`
    6. LogOut ──► `Sign out`
* **Dashboard Drawers:**
  - **Left Friends Drawer:** Triggered by the dock `Friends` button. Slides in from the left edge (`fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50`).
  - **Right Profile Drawer:** Triggered by the top-right profile badge (`H hii`). Slides in from the right edge (`fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50`).

### 2.4 Wingman Hub Modal (`WingmanHubModal.jsx`)
* **Mission:** Enable 2v2 double-talk co-hosting and Gemini conversational wingman assistance.
* **Capabilities:**
  1. AI Conversation Wingman toggle: real-time silence detection and contextual prompts.
  2. Co-pilot Friend Invite: generate wingman share codes for 2v2 group matchmaking.
  3. Interactive UI tokens matching RandomTalks Pro clay & amber aesthetic.

---

## 3. Verification Criteria

- [ ] Rematch loader immediately disappears upon transitioning to a new room.
- [ ] Local webcam starts up and displays immediately on call join without black screens or unmounting bugs.
- [ ] `CallRoom` top-right header displays `[⚡ Add Wingman]`.
- [ ] `FriendProfileModal` renders `[➕ Send Friend Request]` cleanly anchored at the bottom.
- [ ] Left capsule dock icons have crisp labels (`Home`, `Friends`, `Private Room`, `History`, `Settings`, `Sign out`).
- [ ] Top-right profile badge slides in profile drawer from the **RIGHT** edge (`w-80`).
- [ ] Dock Friends icon slides in friends drawer from the **LEFT** edge (`w-80`).
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` compiles cleanly with Vite.
