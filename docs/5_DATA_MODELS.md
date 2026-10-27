# 5. Production Firestore Data Models & Storage Schemas

> **Document ID:** `DOC-005`  
> **Status:** Production Standard  
> **Classification:** Database Schema & Storage Invariants  
> **Last Verified:** 2026-10-20  

---

## 1. Overview & Architectural Principles

RandomTalks leverages Firebase Cloud Firestore as an ACID document store and real-time signaling bus. The database design strictly adheres to three architectural principles:
1. **Single-Field Indexing Constraint:** All queries must function on default single-field indexes without requiring manual composite index provisioning. Complex intersections (such as mutual gender filtering) are handled deterministically in memory after single-field fetching.
2. **Ephemeral Document Lifecycles:** Real-time signaling data (`matchQueue`, `callInvites`) is purged immediately upon connection or decline.
3. **5-Day Sliding Retention Window:** To prevent unbounded storage growth and protect user privacy, direct messages and call history records observe a strict 5-day sliding expiration.

---

## 2. Collection Schema Specifications

### 2.1. `/users/{uid}`
Stores identity attributes, trust ratings, and professional links.
* **Document ID:** Firebase Auth `uid` of the user.
* **Access Rules:** Owner Read/Write; Public read for verified profile card inspection.

| Field Name | Type | Invariant / Validation Rule | Description |
|---|---|---|---|
| `username` | `string` | Length 2–30 chars; trimmed | Public display handle |
| `age` | `number` | Strictly `>= 18` | Legal age attestation required at onboarding |
| `gender` | `enum` | `'Male' \| 'Female' \| 'Non-binary'` | Self-identified gender |
| `genderFilter` | `enum` | `'Any' \| 'Male' \| 'Female'` | Matching preference filter |
| `preferredMode`| `enum` | `'professional' \| 'study' \| 'language' \| 'deeptalk' \| ...` | Default discovery pod mode |
| `occupation` | `string` | Max 60 chars | Title (e.g., "Full-Stack Dev", "CS Student") |
| `country` | `string` | 2-letter code or country name | Geographic location indicator |
| `bio` | `string` | Max 250 chars | Short introductory bio |
| `tags` | `string[]` | Max 8 tags, each max 20 chars | Topic affinities (e.g. `["React", "Rust"]`) |
| `linkedin` | `string` | URL or handle | Professional profile link |
| `github` | `string` | URL or handle | Code portfolio profile link |
| `trustScore` | `number` | Integer `0` to `100` (Defaults to `100`) | Aggregated peer karma rating |
| `strikeCount` | `number` | Integer `>= 0` | Violation strikes; `>= 3` triggers ban |
| `isBanned` | `boolean` | `true` if suspended | Account suspension flag |
| `totalChatsCount` | `number` | Integer `>= 0` | Historical completed chat counter |
| `createdAt` | `timestamp` | `serverTimestamp()` | Account registration epoch |

---

### 2.2. `/matchQueue/{uid}`
The real-time waiting pool for intent-based matchmaking.
* **Document ID:** Firebase Auth `uid` of the waiting user.
* **Access Rules:** Authenticated Read/Write; transaction-locked.

| Field Name | Type | Description |
|---|---|---|
| `uid` | `string` | User's unique ID |
| `username` | `string` | Cached display name for fast pairing |
| `gender` | `string` | Candidate gender |
| `genderFilter`| `string` | Required partner gender |
| `mode` | `string` | Selected Purpose Pod mode (e.g., `professional`, `casual`) |
| `occupation` | `string` | Cached occupation for candidate preview |
| `status` | `enum` | `'waiting'` (active in queue) or `'matched'` (claimed by a transaction) |
| `roomId` | `string \| null` | Deterministic timestamped room ID assigned upon match |
| `matchedWith` | `string \| null` | Peer UID with whom the candidate is paired |
| `joinedAt` | `timestamp` | `serverTimestamp()`; used for memory FIFO queue sorting |

---

### 2.3. `/calls/{roomId}`
Active signaling channel and session container for active video calls.
* **Document ID:** Timestamped room string: `[uidA, uidB].sort().join('_') + '_' + Date.now()`
* **Access Rules:** Restricted strictly to participants: `request.auth.uid in resource.data.participants`.

| Field Name | Type | Description |
|---|---|---|
| `participants`| `string[]` | Array of exactly two peer UIDs `[uidA, uidB]` |
| `callerUid` | `string` | UID of the peer designated as caller / offer initiator |
| `callerOffer` | `map` | WebRTC Session Description: `{ type: 'offer', sdp: string }` |
| `calleeAnswer`| `map` | WebRTC Session Description: `{ type: 'answer', sdp: string }` |
| `status` | `enum` | `'active' \| 'ended'` |
| `isEnded` | `boolean` | Real-time disconnect flag watched by `listenForCallEnd` |
| `mode` | `string` | Purpose mode for the call session |
| `aiIcebreaker`| `string` | Gemini 1.5 Flash synthesized conversation starter |
| `createdAt` | `timestamp` | Room creation timestamp |
| `endedAt` | `timestamp` | Session termination timestamp |

#### Subcollection: `/calls/{roomId}/messages/{messageId}`
* Real-time in-call ephemeral chat.
* Fields: `senderId` (`string`), `senderName` (`string`), `text` (`string`, max 1000 chars), `timestamp` (`serverTimestamp()`).

---

### 2.4. `/call_history/{recordId}`
Persistent connection history and collaborative notes.
* **Document ID:** `${userId}_${roomId}` (guarantees idempotency and prevents duplicate rows).
* **Access Rules:** Owner only: `request.auth.uid == resource.data.userId`.
* **Retention Policy:** Enforces a **5-Day Sliding Window** (`threshold = Date.now() - 5*24*60*60*1000`).

| Field Name | Type | Description |
|---|---|---|
| `userId` | `string` | Owner UID of this history row |
| `strangerUid` | `string` | UID of the connected partner (or `'unknown'`) |
| `strangerName`| `string` | Partner's display name |
| `roomId` | `string` | Call Room ID |
| `mode` | `string` | Mode of the conversation |
| `duration` | `number` | Connected time in seconds |
| `notes` | `string` | Private collaborative notes taken during the call |
| `timestamp` | `timestamp` | Call start timestamp |
| `updatedAt` | `timestamp` | Notes edit timestamp |

---

### 2.5. `/dms/{roomId}` & `/dms/{roomId}/messages/{msgId}`
Direct messaging conduit between mutually confirmed friends.
* **Document ID:** Deterministic string: `[uid1, uid2].sort().join('_dm_')`.
* **Access Rules:** Participants only: `request.auth.uid in resource.data.participants`.
* **Retention Policy:** `DM_RETENTION_MS = 5 * 24 * 60 * 60 * 1000` (5 days). Messages older than 5 days are filtered out from client views and purged.

#### Message Fields (`/dms/{roomId}/messages/{msgId}`):
* `senderUid` (`string`): UID of message author.
* `text` (`string`): Message body (max 500 chars).
* `createdAt` (`timestamp`): Sent timestamp.

---

### 2.6. `/reports/{reportId}`
User abuse and safety reporting ledger.
* **Document ID:** Deterministic deduplication key: `${reporterUid}_${reportedUid}_${roomId}`.
* **Access Rules:** Create-only by authenticated users; Read restricted to administrative panel.

| Field Name | Type | Description |
|---|---|---|
| `reporterUid` | `string` | Submitting user's UID |
| `reportedUid` | `string` | Accused user's UID |
| `roomId` | `string` | Call room ID where the incident occurred |
| `reason` | `enum` | `'harassment' \| 'nudity' \| 'underage' \| 'hate' \| 'spam'` |
| `details` | `string` | Free-form explanation submitted by reporter |
| `status` | `enum` | `'open' \| 'reviewed' \| 'dismissed'` |
| `createdAt` | `timestamp` | Report submission epoch |

---

### 2.7. `/blocks/{blockId}`
Bidirectional user exclusion blocklist.
* **Document ID:** `${blockerUid}_${blockedUid}`.
* **Access Rules:** Owner Read/Write.

| Field Name | Type | Description |
|---|---|---|
| `blockerUid` | `string` | User creating the block |
| `blockedUid` | `string` | User being blocked from future matching |
| `createdAt` | `timestamp` | Epoch of block creation |

---

### 2.8. Auxiliary Social & Private Room Collections

* **`/callInvites/{receiverUid}`:**
  * Real-time direct call signaling bus.
  * Fields: `callerUid`, `callerName`, `receiverUid`, `roomId`, `status` (`'pending' | 'declined'`), `createdAt`.
* **`/privateRooms/{code}`:**
  * 6-digit numeric room index for custom private rooms.
  * Fields: `code` (`string`), `roomId` (`string`), `createdBy` (`string`), `createdAt`.
* **`/networkExchanges/{roomId}/intents/{uid}`:**
  * Double opt-in mutual contact exchange.
  * Fields: `uid`, `displayName`, `linkedin`, `github`, `sharedAt`.
