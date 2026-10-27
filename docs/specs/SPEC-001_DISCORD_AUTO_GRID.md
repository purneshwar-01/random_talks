# SPEC-001: Discord-Style Dynamic Multi-Peer Auto-Grid & Active Speaker Highlighting

> **Feature ID:** `B.01`  
> **Document ID:** `SPEC-001`  
> **Target Component:** `src/pages/CallRoom.jsx`  
> **Status:** Approved Architectural Specification  
> **Author:** Antigravity Engineering  
> **Enforcement:** `.antigravity/rules.md` (Laws 11, 12, 13, 18, 31, 35)  
> **Last Updated:** 2026-10-20  

---

## 1. Executive Summary & Objective

In real-time multi-peer video platforms, static two-box video containers create severe layout friction:
1. When solo (waiting or test mode), small off-center boxes look deserted and broken.
2. In 1-on-1 calls, rigid containers cause letterboxing or unnatural aspect ratios.
3. In multi-peer calls (3 to 6 participants), static containers lack responsive packing and overflow the viewport, violating the zero-scrollbar invariant.
4. During screen share sessions, viewers cannot read text or code if the screen is constrained to equal visual weight with webcam feeds.
5. In conversations with multiple peers, it is difficult to determine who is speaking without tactile audio visual cues.

**SPEC-001** defines the mathematical auto-packing grid, spring physics transitions, spotlight screen-share architecture, and Web Audio API active speaker detection for `src/pages/CallRoom.jsx`.

---

## 2. Dynamic Auto-Packing Grid Rules

The stage layout dynamically adapts based on the total number of active peers $N$ (where $N = 1 + \text{connected remote peers}$) and whether screen sharing is active.

### 2.1 Participant Grid Matrix

| Total Active Peers ($N$) | Stage Mode | Layout Rule | Viewport & Card Sizing |
|---|---|---|---|
| **1 Peer** *(Solo / Waiting)* | Centered Hero | `flex items-center justify-center w-full h-full p-2` | Max width `max-w-4xl aspect-video mx-auto w-full`. Single dominant stage. |
| **2 Peers** *(1-on-1 Discovery)* | Symmetrical 1×2 | `grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full` | 50/50 split on desktop, stacked on mobile. Equal visual weighting. |
| **3–4 Peers** *(Wingman / Group)* | Balanced 2×2 | `grid grid-cols-2 grid-rows-2 gap-3 w-full h-full` | 4-quadrant auto-packing. Cards maintain 16:9 aspect fit. |
| **5–6 Peers** *(Team Lounges)* | Balanced 2×3 | `grid grid-cols-3 grid-rows-2 gap-2.5 w-full h-full` | 6-card symmetrical canvas. Zero window scrollbar guarantee within `100dvh`. |

### 2.2 Screen Sharing Spotlight Mode

When `screenSharing === true`:
* **Dominant Screen Stage:** Occupies 75%–80% of vertical viewport height (`flex-1 w-full min-h-0`). Feed rendered with `object-contain bg-black` so text, presentations, and code editors remain 100% legible.
* **Top Horizontal Filmstrip:** Participant video tiles are neatly arranged in a top horizontal scrolling strip (`flex items-center gap-3 overflow-x-auto pb-2 shrink-0 h-36 md:h-44 w-full`).
* **Aspect Ratio:** Filmstrip participant cards maintain `aspect-video h-full shrink-0 rounded-2xl` with micro-badges and active speaker highlights.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Local User]    [Remote Peer 1]    [Remote Peer 2]   ... (Filmstrip)  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                                                                        │
│                      SPOTLIGHT SCREEN VIEWPORT                         │
│                           (75% Height)                                 │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Real-Time Active Speaker Detection (Web Audio API)

### 3.1 Audio Processing Pipeline

1. **Stream Binding:** Each active stream (`localStreamRef` and `remoteStreamRef`) connects to a dedicated `AudioContext`.
2. **Frequency Analysis:** An `AnalyserNode` with `fftSize = 64` and `smoothingTimeConstant = 0.4` calculates frequency bin averages.
3. **Threshold Calibration:**
   - Active Speech Threshold: Normalized RMS volume $> 15$ (scale $0–100$).
   - Hysteresis: `smoothingTimeConstant: 0.4` prevents rapid visual flickering or false triggers from background ambient noise.
4. **Visual Glow Illumination:**
   - Active Speaker Tokens: `border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/50`
   - Inactive / Baseline Tokens: `border-white/10 shadow-2xl`

---

## 4. Design System Tokens & Framer Motion Physics

### 4.1 Card Container Tokens
* **Border Radius:** `rounded-3xl` (or `rounded-2xl` inside compact filmstrip)
* **Surface Background:** Deep neutral `#111318`
* **Default Border:** 1px subtle `border-white/10`
* **Card Shadow:** `shadow-2xl`
* **Participant Badge:** Top-left floating glass capsule:
  ```html
  <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/95 border border-white/10 shadow-lg flex items-center gap-2">
    <span>{username}</span>
    {isMuted ? <MicOff size={11} className="text-red-400" /> : <Mic size={11} className="text-emerald-400" />}
  </div>
  ```

### 4.2 Framer Motion Spring Physics (Law 31)
* Layout transitions utilize Framer Motion `motion.div` with:
  ```javascript
  layout
  transition={{
    type: "spring",
    stiffness: 380,
    damping: 30
  }}
  ```
* Seamlessly animates card scaling and repositioning when peers join, leave, or switch into screen-share spotlight mode.

---

## 5. Teardown & Invariant Guarantees

1. **Law 11 (MediaTrack Teardown):** All acquired audio and video tracks must execute `.stop()` on unmount.
2. **Law 12 (No `display: none` on `<video>`):** Never apply `hidden` or `display: none` to active `<video>` elements playing WebRTC media streams. Disabled cameras render video opacity 0 with fallback avatar overlays.
3. **Law 13 (AudioContext Teardown):** All `AudioContext` instances must invoke `.close()` in cleanup handlers to prevent audio hardware thread exhaustion.
4. **Law 35 (Zero Scrollbars):** Video call canvas must strictly fit within `100dvh` and `100vw` without triggering document or body scrollbars.

---

## 6. Verification Criteria

- [ ] Solo / Waiting state renders a clean centered hero card (`max-w-4xl aspect-video mx-auto`).
- [ ] 2-peer call renders symmetrical 50/50 split (`grid-cols-1 md:grid-cols-2`).
- [ ] Multi-peer rooms (3–4 peers) auto-pack into balanced 2×2 quadrants (`grid-cols-2 grid-rows-2`).
- [ ] Multi-peer rooms (5–6 peers) auto-pack into 2×3 matrix with zero page scrollbars.
- [ ] Activating screen share transitions to dominant stage (75% height) + top horizontal filmstrip.
- [ ] Microphone volume $> 15$ triggers Solid Amber glowing border on active speaker's card (`border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.35)]`).
- [ ] All card re-arrangements animate smoothly using Framer Motion spring physics.
- [ ] `npm run lint` and `npm run build` pass with 0 errors.
