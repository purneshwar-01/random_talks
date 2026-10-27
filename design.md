# Design System Specification — RandomTalks Pro
Version: 1.0.0
Architecture: Raycast Command HUD + LiveKit Real-Time Video
Color Identity: Palette 1 (Apple/Raycast Electric Blue & Charcoal Slate)

---

## 1. Design Principles
1. High-Trust Engineering: Silicon Valley level finish (#1D1D1F base) that eliminates any sketchy or unmoderated random-chat feel.
2. Raycast Tactile Depth: Every card features an inner top highlight (inset bevel) and subtle border glow.
3. Zero-Latency Ergonomics: Real-time WebRTC streams remain uncluttered; all controls live in a floating frosted dock at the bottom.

---

## 2. Color Tokens (Tailwind CSS Mapping)

### Canvas & Surfaces
- `bg-canvas`: `#121214` (Deepest backdrop void)
- `bg-surface`: `#1D1D1F` (Raycast cards, modals, sidebar background)
- `bg-surface-hover`: `#2A2A2D` (Interactive hover state)
- `bg-glass`: `rgba(29, 29, 31, 0.75)` with `backdrop-blur-xl`

### Borders & Optical Highlights
- `border-subtle`: `rgba(255, 255, 255, 0.08)` (Default 1px perimeter border)
- `border-highlight`: `rgba(255, 255, 255, 0.14)` (Card top bevel / active border)
- `border-glow`: `rgba(0, 122, 255, 0.45)` (Electric blue focus border)

### Brand & Accents
- `accent-primary`: `#007AFF` (Electric Blue — Primary CTA, "Next Stranger")
- `accent-primary-hover`: `#0062CC`
- `accent-glow`: `rgba(0, 122, 255, 0.22)` (Radial halo spotlight)
- `accent-warm`: `#FCA311` (Warm Amber — dedicated to "Friends & Casual" category tag)
- `accent-verified`: `#10B981` (Emerald — verified identity badges & ping < 40ms)
- `accent-danger`: `#EF4444` (Rose Red — Mute active & End Call)

### Typography Tokens
- `text-primary`: `#F5F5F7` (Main headings, prominent user labels, call clock)
- `text-muted`: `#AAAAAA` (Subtitles, metadata, form labels)
- `text-dim`: `#6E6E73` (Inactive key hints, placeholder text)

---

## 3. Typography & Hierarchy
- Primary Sans: 'Inter' or 'Geist' (`font-sans`)
- Telemetry Numbers: 'JetBrains Mono' or 'Geist Mono' (`font-mono`)
- Scales:
  - Hero Title: `text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]`
  - Section Head: `text-lg font-medium text-[#F5F5F7]`
  - Body Text: `text-sm font-normal text-[#AAAAAA] leading-relaxed`
  - Pill Meta: `text-xs font-mono tracking-wider uppercase`

---

## 4. Raycast Component Blueprints

### A. Auth / Gateway Card (Command Prompt Style)
- Container: `max-w-md w-full bg-[#1D1D1F]/90 backdrop-blur-2xl rounded-2xl`
- Border: `border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_24px_48px_-12px_rgba(0,0,0,0.8)]`
- Inputs:
  - Base: `bg-[#121214] border border-white/[0.08] text-[#F5F5F7] rounded-xl px-4 py-3 text-sm`
  - Focus: `focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/50 focus:shadow-[0_0_20px_rgba(0,122,255,0.15)]`
- Primary CTA:
  - Class: `bg-[#007AFF] hover:bg-[#0062CC] text-white font-medium rounded-xl py-3 shadow-[0_0_20px_rgba(0,122,255,0.3)] transition-all duration-150 active:scale-[0.98]`

### B. Purpose Category Pills (Lobby)
- "Tech & Career": `bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/30`
- "Friends & Casual": `bg-[#FCA311]/10 text-[#FCA311] border border-[#FCA311]/30`
- "Verified Only": `bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30`

### C. Matching State (Raycast Beacon)
- Structure: Central pulsating node with twin expanding rings using `#007AFF` opacity decay.
- Terminal text: `text-xs font-mono text-[#AAAAAA] mt-4`

### D. Active Video Calling Viewport & HUD Dock
- Remote Stranger Feed: `rounded-2xl border border-white/[0.06] overflow-hidden`.
- Self View: `w-48 aspect-video rounded-xl border border-white/10 shadow-2xl`.
- Floating dock: `h-14 px-4 bg-[#1D1D1F]/80 backdrop-blur-2xl border border-white/[0.1] rounded-full flex items-center gap-3 shadow-2xl`.

---

## 5. Signature Animations (Motion Rules)

### Cursor-Following Radial Halo
```css
background-image: radial-gradient(
  650px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
  rgba(0, 122, 255, 0.08),
  transparent 80%
);
```

### Spring Curves (Framer Motion)
- Standard Switch / Modal Open: `transition={{ type: "spring", stiffness: 350, damping: 28 }}`
- Call Connect Handshake: `600ms aperture scale with 300ms video blur dissolution (blur(10px) -> blur(0px))`

## 6. Performance & WebRTC Protection Rules

- Max 1 WebGL Context: Run background presence orb only during Pre-Auth/Lobby.
- Call Initiation Trigger: When entering an active WebRTC room, unmount all 3D canvases to dedicate 100% GPU bandwidth to video decoding.
- Mobile Viewports (< 768px): Fall back to static CSS gradients; render chat as a slide-up bottom drawer.
