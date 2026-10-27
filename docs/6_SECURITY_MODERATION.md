# 6. Security, Trust & Moderation Architecture

> **Document ID:** `DOC-006`  
> **Status:** Production Standard  
> **Classification:** Trust, Safety & Compliance Protocol  
> **Last Verified:** 2026-10-20  

---

## 1. Safety Architecture Philosophy

Traditional random chat failed because anonymity was weaponized without consequence. RandomTalks enforces a high-trust paradigm through three foundational pillars:
1. **Architectural Gating:** Strict legal age attestation and bidirectional blocklists enforced before queue entry.
2. **Article 3 Moderation Protocol:** Karma-weighted reporting, automated 3-strike escalation, and algorithmic deterrence against malicious false reports.
3. **Cryptographic P2P Media Isolation:** Zero-vendor DTLS-SRTP end-to-end encryption with zero server-side recording or intermediate video taps.

---

## 2. Article 3 Moderation Protocol

To maintain a self-policing community without incurring massive manual moderation overhead, RandomTalks implements the **Article 3 Moderation Framework**:

```
                              REPORT SUBMITTED
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │   DEDUPLICATION & CONTEXT CHECK   │
                   │  Key: reporterUid_targetUid_roomId│
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │    KARMA WEIGHT & REPUTATION      │
                   │ Reporter TrustScore >= 80 ? (1.0x)│
                   │ Reporter TrustScore < 50 ? (0.2x) │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
       ┌─────────────────────────────┴─────────────────────────────┐
       ▼                                                           ▼
[VALIDATED ABUSE INCIDENT]                                [MALICIOUS / SPAM REPORT]
       │                                                           │
       ▼                                                           ▼
• Target StrikeCount += 1                                  • Reporter TrustScore -= 15
• Target TrustScore -= 25                                  • Reverse Strike applied to reporter
• If StrikeCount >= 3 ──► PERMANENT BAN                   • Report auto-dismissed
```

### 2.1. Deduplicated Reporting Key
Reports are keyed deterministically by:
```javascript
const dedupId = `${reporterUid}_${reportedUid}_${roomId || 'noroomid'}`;
```
This invariant prevents report bombing: a disgruntled user cannot spam 50 reports in a single session to trigger an automated ban. Only one report per room interaction can be committed.

### 2.2. The 3-Strike Escalation Ladder
User accounts maintain a `strikeCount` in `/users/{uid}`:
* **Strike 1 (Warning):** Trust score reduced to 75%. Account flagged with an amber warning banner in the Dashboard and Friends drawer.
* **Strike 2 (Probation):** Trust score reduced to 50%. Account barred from `professional` and `study` Focus Pods for 7 days; restricted to Casual Lounge only.
* **Strike 3 (Permanent Suspension):** `isBanned` set to `true`. Matchmaking is completely blocked. Client-side and Firestore security rules reject all queue joins.

### 2.3. Deterrence Against Malicious False Reports
To prevent bad actors from retaliating against users who decline an invitation or hang up early, reports submitted by users with low trust scores (`< 50%`) undergo algorithmic dampening. If an account repeatedly submits false or uncorroborated reports, the system automatically docks 15 points from the reporter's trust score and issues a strike for moderation griefing.

---

## 3. End-to-End P2P Media Privacy

### 3.1. Zero Intermediate Media Servers
Unlike systems using ZegoCloud, Twilio Video, or Agora, RandomTalks uses pure WebRTC:
* **Transport:** Native browser-to-browser UDP sockets established via Google Public STUN servers.
* **Encryption:** All audio, video, and data channel frames are encrypted peer-to-peer using **DTLS 1.3** (Datagram Transport Layer Security) and **SRTP** (Secure Real-Time Transport Protocol).
* **Zero Interception:** Neither Firebase, Google STUN, nor the host application can inspect, tap, or record raw video/audio frames in transit.

### 3.2. Ephemeral Chat & Data Sanitization
* In-call chat messages (`/calls/{roomId}/messages`) exist solely for the duration of the call.
* Direct messages between friends enforce `DM_RETENTION_MS = 5 * 24 * 60 * 60 * 1000` (5 days).
* Call history logs enforce single-field indexing with client-side 5-day sliding window filtering to minimize long-term data footprint.

---

## 4. Legal Age Gating (Strict 18+)

RandomTalks is strictly an adult, high-trust networking environment.

### 4.1. Onboarding Verification
During initial profile creation ([`src/pages/ProfileSetup.jsx`](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/ProfileSetup.jsx)):
1. Users must input their numerical age.
2. The client checks `age >= 18`. If `< 18`, form submission is blocked with an explicit error.
3. Users must check a mandatory legal attestation acknowledging zero tolerance for illicit content.

---

## 5. Bidirectional Exclusion Blocklists

To guarantee that a user never reconnects with someone they have blocked (or who has blocked them):
* Blocks are stored in `/blocks/{blockerUid}_{blockedUid}`.
* When executing matchmaking, `getExclusionSet(uid)` queries both:
  1. `where('blockerUid', '==', uid)` (users I blocked)
  2. `where('blockedUid', '==', uid)` (users who blocked me)
* The combined Set is excluded in memory during candidate evaluation inside `tryMatch()`.
* If a blocked user is encountered in the waiting queue, they are passed over silently with zero match commitment.
