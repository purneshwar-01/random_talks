# 3. Discord-Style Call Stage Specification

> **Document ID:** `DOC-003`  
> **Status:** Standard Specification  
> **Classification:** Dynamic Canvas & Multi-Peer Layout Engine  
> **Last Verified:** 2026-10-20  

---

## 1. Design Objective

The Call Stage must eliminate traditional letterboxing, awkward picture-in-picture floaters, and viewport overflow. Borrowing from modern Discord and Google Meet ergonomics, the canvas uses a **Dynamic Auto-Packing Stage Layout** that mathematically distributes video feeds across the viewport to maximize face area while guaranteeing:
1. **Zero Scrollbars:** The entire stage fits strictly within `100dvh` and `100vw`.
2. **Aspect Ratio Preservation:** Feeds maintain standard 16:9 or 4:3 ratios via `object-fit: cover` with rounded borders.
3. **Decoupled Ambient Controls:** The floating frosted control dock remains anchored 24px above the bottom edge without obscuring video streams.

---

## 2. Participant Auto-Packing Matrix

| Participant Count | Grid Layout Matrix | CSS Tailwind Grid Rule | Video Card Proportions & Behavior |
|---|---|---|---|
| **1 Participant** *(Solo / Waiting)* | `1 × 1` Centered Canvas | `flex items-center justify-center` | Single centered hero card (max `w-full max-w-3xl aspect-video`) with pre-flight loopback audio visualizer. |
| **2 Participants** *(Standard 1:1)* | `1 × 2` Side-by-Side (Desktop)<br>`2 × 1` Stacked (Mobile) | `grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 h-full` | Symmetrical 50/50 split. Both users have equal visual weight. |
| **3 Participants** | `2 × 2` Dynamic Packing | `grid grid-cols-2 grid-rows-2 gap-3 h-full` | Top row: 2 feeds side-by-side (50% each). Bottom row: 1 centered feed (spanning 2 columns or centered). |
| **4 Participants** | `2 × 2` Symmetrical Grid | `grid grid-cols-2 grid-rows-2 gap-3 h-full` | Balanced 4-quadrant layout with 1:1 cell heights. |
| **5 Participants** | `2 × 3` Dynamic Packing | `grid grid-cols-3 grid-rows-2 gap-2.5 h-full` | Top row: 3 feeds. Bottom row: 2 centered feeds. |
| **6 Participants** | `2 × 3` Full Matrix | `grid grid-cols-3 grid-rows-2 gap-2.5 h-full` | Complete 6-card symmetrical canvas. Zero scrollbar guarantee. |

```
── 1 PEER (SOLO / WAITING) ──           ── 2 PEERS (1:1 SYMMETRICAL) ──
┌───────────────────────────────┐       ┌───────────────┬───────────────┐
│                               │       │               │               │
│      [LOCAL HERO FEED]        │       │  LOCAL PEER   │  REMOTE PEER  │
│                               │       │    (50%)      │    (50%)      │
└───────────────────────────────┘       └───────────────┴───────────────┘

── 3–4 PEERS (2×2 QUADRANT) ──          ── 5–6 PEERS (2×3 PACKED) ────
┌───────────────┬───────────────┐       ┌─────────┬─────────┬─────────┐
│    PEER A     │    PEER B     │       │ PEER A  │ PEER B  │ PEER C  │
├───────────────┼───────────────┤       ├─────────┼─────────┼─────────┤
│    PEER C     │    PEER D     │       │ PEER D  │ PEER E  │ PEER F  │
└───────────────┴───────────────┘       └─────────┴─────────┴─────────┘
```

---

## 3. Screen Share Spotlight Mode

When any participant engages `getDisplayMedia()` screen sharing, the stage automatically switches from symmetrical grid mode to **Spotlight Presentation Mode**:

```
┌─────────────────────────────────────────────────────────┬───────────────┐
│                                                         │ FILMSTRIP     │
│                                                         ├───────────────┤
│                                                         │ Participant 1 │
│                                                         ├───────────────┤
│                 SPOTLIGHT STAGE                         │ Participant 2 │
│              (Active Screen Stream)                     ├───────────────┤
│                                                         │ Participant 3 │
│              Aspect-Ratio: 16:9 Fit                     ├───────────────┤
│                                                         │ Participant 4 │
│                                                         │               │
└─────────────────────────────────────────────────────────┴───────────────┘
```

* **Main Stage (`flex-1 h-full`):** Screen share feed renders with `object-fit: contain` so code, slides, and browser tabs are 100% legible without cropping.
* **Participant Filmstrip (`w-64 flex flex-col gap-3 shrink-0`):** Participant video camera tiles are displayed vertically along the right perimeter (or horizontally on top for mobile viewports).

---

## 4. Active Speaker Audio Detection (Web Audio API)

Active speakers are dynamically highlighted with a glowing border to facilitate organic conversation flow without verbal interruptions.

### 4.1. Audio Analysis Pipeline
1. Connect participant `MediaStream` to a native `AudioContext`.
2. Route audio through an `AnalyserNode` with `fftSize = 256` and smoothing time constant of `0.4`.
3. Sample Root-Mean-Square (RMS) volume using `requestAnimationFrame`.
4. If volume exceeds the calibrated speech threshold (`> 15 dB` above noise floor) for consecutive frames:
   - Apply active speaker class: `ring-2 ring-[#FCA311] shadow-[0_0_24px_rgba(252,163,17,0.35)]`.
   - Update speaker metadata indicator on card overlay.

```javascript
export function attachSpeakerDetector(stream, onSpeakingChange) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let isSpeaking = false;

  function checkVolume() {
    analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    const avg = sum / dataArray.length;
    const currentlySpeaking = avg > 20;

    if (currentlySpeaking !== isSpeaking) {
      isSpeaking = currentlySpeaking;
      onSpeakingChange(isSpeaking);
    }
    requestAnimationFrame(checkVolume);
  }
  checkVolume();

  return () => {
    audioCtx.close();
  };
}
```

---

## 5. Overlay HUD Components on Video Feeds

Every participant tile features non-intrusive metadata badges:
1. **Top-Left Identity Pill:** Username, verified shield icon, and country flag.
2. **Top-Right Hardware State:** Camera-off avatar fallback, mic muted indicator (`MicOff` in red badge).
3. **Bottom-Left Network Health:** P2P RTT ping status indicator (Green `< 50ms`, Amber `50-150ms`, Red `> 150ms`).
4. **Bottom-Right Action Trigger:** Quick "Add Friend" or "Inspect Profile" button.
