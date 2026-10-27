# SPEC-003: Direct Dynamic Friend Invite Link, 3-Peer Room Capacity & Clean Auth Gate

> **Feature ID:** SPEC-003  
> **Status:** APPROVED  
> **Author:** SDD Sprint Engine  
> **Created:** 2026-10-20  
> **Iron Laws Referenced:** 12, 16, 20, 31, 33, 34, 35, 37, 42, 47, 48, 50

---

## 1. Overview

This specification replaces the complex "Wingman Hub" / "AI Wingman" / "Silence Assist" / "2v2 Co-Pilot" system with a clean, direct 1-click friend invite link and enforces a strict 3-peer room capacity. The lightweight AI Icebreaker engine (`Sparkles` icon in CallRoom dock) is explicitly **retained**.

---

## 2. Architectural Directives

### Directive 1 — Permanent AI Wingman Purge

| Component | Action |
|---|---|
| `WingmanHubModal.jsx` | Delete the file entirely |
| `CallRoom.jsx` | Remove `WingmanHubModal` import, `wingmanOpen` state, "Add Wingman" button, and `<WingmanHubModal />` JSX |
| `Dashboard.jsx` | Remove `WingmanHubModal` import, `wingmanOpen` state, "[⚡ Add Wingman]" header button, and `<WingmanHubModal />` JSX |

**Retained:** The serverless AI Icebreaker engine (Gemini-powered `generateIcebreaker()` and `Sparkles` icon banner in CallRoom) remains untouched.

### Directive 2 — Direct 1-Click Friend Invite Link (CallRoom Header)

- Replace the "Add Wingman" button in the CallRoom top-right header with a `[🔗 Invite Friend]` button.
- **Dynamic URL construction:** `window.location.origin + '/call/' + currentRoomId`
- **Zero hardcoded domains:** Works automatically on `localhost:5173`, staging, and production.
- **Clipboard copy:** Uses `navigator.clipboard.writeText()` with a 2-second spring feedback state: `[✓ Link Copied!]`.
- Spring transition per Law 31: `{ type: 'spring', stiffness: 380, damping: 30 }`.

### Directive 3 — Room Capacity & "Room Full" Graceful Flow

- **Maximum participants per room:** Strictly **3 peers**.
- If a user navigates to `/call/:roomId` and the room document (`calls/{roomId}`) has `participants.length >= 3` and the current user is **not** already in `participants`:
  - Display a **"Room is Full (3/3)"** modal immediately.
  - Heading: "Room is Full (3/3)"
  - Subtitle: "This conversation has reached its maximum capacity of 3 participants."
  - Primary CTA: `[🚀 Start Your Own Conversation]` → navigates to `/dashboard`.
- The `totalActivePeers` calculation is capped at `Math.min(3, ...)` to enforce the 3-peer limit.

### Directive 4 — Strict Authentication Gating

- Unauthenticated visitors clicking an invite link (`/call/:roomId`) are intercepted by the existing `ProtectedRoute` component, which redirects to `/` (Landing / Login page).
- Upon successful authentication, React Router's `Navigate` logic routes the user to their intended destination.
- **Enhancement:** Store the intended destination path in `sessionStorage` before redirect and consume it post-authentication for seamless deep-link routing.

---

## 3. Component-Level Changes

### 3.1 `src/components/WingmanHubModal.jsx`
- **DELETE** this file entirely.

### 3.2 `src/pages/CallRoom.jsx`

| Section | Change |
|---|---|
| Import block | Remove `WingmanHubModal` import; add `Link2` from `lucide-react` |
| State declarations | Remove `wingmanOpen`; add `inviteCopied` state and `roomFullBlocked` state |
| Header right section | Replace "Add Wingman" button with `[🔗 Invite Friend]` dynamic clipboard button |
| Room listener | Add `roomFullBlocked` guard checking `participants.length >= 3` |
| `totalActivePeers` | Cap at `Math.min(3, ...)` |
| Multi-peer cards | Remove "Wingman 2v2" comment label |
| Bottom modals | Remove `<WingmanHubModal />` render |
| New modal | Add "Room is Full" graceful dialog |

### 3.3 `src/pages/Dashboard.jsx`

| Section | Change |
|---|---|
| Import block | Remove `WingmanHubModal` import |
| State declarations | Remove `wingmanOpen` state |
| Header right | Remove "[⚡ Add Wingman]" button |
| Bottom modals | Remove `<WingmanHubModal />` render and conditional |

### 3.4 `src/App.jsx`

| Section | Change |
|---|---|
| `ProtectedRoute` | Add `sessionStorage` redirect capture for post-auth deep-linking |

---

## 4. Verification Criteria

| # | Criterion | Pass Condition |
|---|---|---|
| 1 | Invite button renders in CallRoom header | `[🔗 Invite Friend]` visible in top-right |
| 2 | Dynamic URL uses `window.location.origin` | No hardcoded domain; works on localhost and production |
| 3 | Clipboard copy with 2s feedback | Button transitions to `[✓ Link Copied!]` for 2000ms |
| 4 | Room capacity capped at 3 | 4th user sees "Room is Full" modal |
| 5 | Auth gate on invite links | Unauthenticated user redirected to login; post-auth routes to room |
| 6 | AI Wingman fully purged | No references to WingmanHub, Silence Assist, or AI Wingman in codebase |
| 7 | AI Icebreaker retained | `Sparkles` banner and `generateIcebreaker()` still functional |
| 8 | `npm run lint` passes | 0 errors, 0 warnings |
| 9 | `npm run build` passes | 0 compile errors |

---

## 5. Iron Law Compliance Matrix

| Law | Requirement | How Addressed |
|---|---|---|
| 12 | No `display: none` on active `<video>` | No video element changes in this spec |
| 31 | Framer Motion spring physics | Invite button feedback uses calibrated spring |
| 33 | Tactile active press feedback | `active:scale-95` on invite button |
| 35 | Zero scrollbar stage constraint | No layout changes affecting viewport |
| 42 | Zero fake/mock architecture | Real clipboard API and Firestore participant reads |
| 47 | Strict spec-driven development | This SPEC-003 document |
| 48 | Checklist synchronization | Master checklist updated upon completion |
| 50 | Preserve comments & documentation | Existing comments preserved; only wingman-specific removed |
