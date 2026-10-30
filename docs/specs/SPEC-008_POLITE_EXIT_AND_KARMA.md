# SPEC-008: The Silent Decline (Polite Exit Engine) & Builder Karma Trust System

## Executive Architectural Summary
**Specification ID:** SPEC-008  
**Module Target:** `random_talks` (In-Call Signaling, Moderation & Trust Layer, Profile Modal, Feedback Flow)  
**Status:** Complete & Verified (`exit code 0` on `npm run lint` and `npm run build`)  
**Lead Systems Architect:** Antigravity Principal Systems Architect  

SPEC-008 introduces two pivotal engagement and social safety pillars to RandomTalks Pro:
1. **The Silent Decline (Polite Exit Engine):** Eliminates the awkward, jarring friction of sudden disconnects in stranger video chat by providing in-call preset exits ("Quick Coffee Break", "Connection/Battery Low", "Urgent Doorbell/Call"). When selected, a structured signaling event (`exitReason`) is broadcast via the call document, displaying a warm exit banner to the remote partner accompanied by an instant 1-click **[Add Friend]** CTA before safely routing the user to `/dashboard`.
2. **Builder Karma Trust Engine:** Establishes an atomic, peer-awarded reputation metric (`karmaScore`) stored in Firestore. Users can endorse conversation partners directly in the post-call feedback modal (+5 Karma for "Great Conversation", +10 Karma for "Helpful Builder"). Live Karma scores and trust badges are displayed alongside an amber shield icon (🛡️) across in-call video name tags and the user profile modal.

---

## 1. The Silent Decline: Polite Exit Engine

### Architectural Problem
In traditional stranger video chat applications (e.g. Omegle, Chatroulette), conversations end abruptly when a user clicks "Next" or closes the window. This creates social anxiety, perceived rejection, and awkwardness when users simply have real-life interruptions (deliveries, battery dips, needing a drink).

### The Polite Exit Workflow
In [CallRoom.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/CallRoom.jsx), a high-contrast amber button `[☕ Polite Exit]` is placed adjacent to the red `[Leave Call]` button in the in-call bottom controls dock:

```jsx
<button
  type="button"
  onClick={() => setPoliteExitOpen(true)}
  className="h-10 px-3.5 sm:px-4 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap cursor-pointer shadow-md"
  title="The Silent Decline (Polite Exit)"
>
  <Coffee size={16} className="text-[#FCA311]" />
  <span className="hidden sm:inline">Polite Exit</span>
</button>
```

### The 3 Presets & Glassmorphic Sheet
Clicking opens a glassmorphic sheet featuring 3 preset exit reasons:
- ☕ **Quick Coffee Break:** "Stepping away for a quick beverage, snack, or stretch."
- 🔋 **Connection/Battery Low:** "Hardware battery is dipping low or network connection is unstable."
- 🔔 **Urgent Doorbell/Call:** "A real-world delivery, doorbell chime, or urgent phone call arrived."

### Real-Time Firestore Signaling
When a preset is selected, `handlePoliteExit` atomically writes an `exitReason` object to `/calls/{roomId}`:
```javascript
await updateDoc(doc(db, 'calls', currentRoomId), {
  status: 'ended',
  isEnded: true,
  exitReason: {
    senderUid: user.uid,
    senderName: profile?.username || 'Stranger',
    type: option.id,
    text: option.text,
    timestamp: Date.now(),
  },
  endedAt: serverTimestamp(),
});
```
The exiting user cleanly tears down WebRTC tracks, persists call notes/history, and navigates smoothly to `/dashboard`.

### Remote Partner Experience & Instant [Add Friend] CTA
The remote partner's real-time snapshot listener detects `callData.exitReason` and presents the **Polite Exit Notice Modal** instead of the generic disconnect screen:
- Contextual icon (`Coffee`, `BatteryCharging`, or `Bell`).
- Headline: `"${senderName} Took a Polite Exit"`.
- Reason pill badge with the chosen explanation.
- **Instant 1-Click [Add Friend] CTA:** Allows the partner to immediately send a friend request to stay connected before finding their next stranger.
- Primary CTA: `[⚡ Find Next Stranger]` and `[Leave to Dashboard]`.

---

## 2. Builder Karma Trust System

### Data Architecture & Atomicity
Karma is stored directly on the `/users/{uid}` document as an integer `karmaScore`.

In [moderation.js](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/lib/moderation.js), the function `upvoteUserKarma` utilizes Firestore's atomic `increment` operator:
```javascript
export async function upvoteUserKarma(targetUid, points = 5) {
  if (!targetUid || points <= 0) return;
  try {
    const userRef = doc(db, USERS, targetUid);
    await updateDoc(userRef, {
      karmaScore: increment(points),
    });
    console.info(`[Moderation] Successfully awarded +${points} Karma to ${targetUid}`);
  } catch (err) {
    console.warn('[Moderation] upvoteUserKarma notice:', err);
  }
}
```

### Security Rules Hardening (`firestore.rules`)
To prevent arbitrary modification of sensitive profile fields while allowing authenticated peers to endorse each other, the `/users/{uid}` update rule was hardened:
```rules
match /users/{uid} {
  allow read: if isAuthenticated();
  allow create: if isOwner(uid)
                && (!('isBanned' in request.resource.data) || request.resource.data.isBanned == false)
                && (!('strikeCount' in request.resource.data) || request.resource.data.strikeCount == 0);
  allow update: if (isOwner(uid)
                && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['isBanned', 'strikeCount'])))
                || (isAuthenticated()
                && request.auth.uid != uid
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['karmaScore'])
                && (!('karmaScore' in resource.data) || request.resource.data.karmaScore > resource.data.karmaScore));
  allow delete: if false;
}
```
**Security Guarantees:**
- An authenticated peer (`request.auth.uid != uid`) can **only** touch the `karmaScore` field (`affectedKeys().hasOnly(['karmaScore'])`).
- The operation must strictly increment the score (`request.resource.data.karmaScore > resource.data.karmaScore`).
- Peer cannot mutate bans, strikes, usernames, or any other user property.

---

## 3. UI/UX Implementations

### Feedback Modal Endorsements ([FeedbackModal.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/components/FeedbackModal.jsx))
Post-call feedback now presents 1-click Karma endorsements:
- **"Great Conversation" (+5 Karma):** For engaging, enjoyable dialogues.
- **"Helpful Builder" (+10 Karma):** For technical mentorship, code brainstorming, and constructive help.
- Displays a celebratory shield animation confirming the points awarded to the partner.

### Video Card Name Tags ([CallRoom.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/pages/CallRoom.jsx))
Every active video card features a live Karma pill badge next to the username:
```jsx
<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#FCA311] border border-amber-500/30 text-[10px] font-bold">
  <Shield size={10} className="fill-amber-400/20 text-amber-400 shrink-0" />
  <span>{peerProf?.karmaScore ?? 0} Karma</span>
</span>
```
Rendered across:
- **Local User Card** (`(You)`)
- **Remote Peer Grid Cards**
- **Spotlight Screen Share Filmstrip**

### User Profile Modal ([FriendProfileModal.jsx](file:///c:/Users/PURNESHWAR/Desktop/my%20projects/random_talks/src/components/FriendProfileModal.jsx))
- Prominent Builder Karma chip with amber shield next to the header username.
- Dedicated 3-column stats grid displaying **Builder Karma** (`{karmaScore} pts`), **Trust Score** (`{trustScore}%`), and **Location**.

---

## 4. Verification & Lint Results

```bash
> npm run lint
> eslint .
# Exit code: 0 (Zero errors, zero warnings)

> npm run build
> vite build
✓ 1928 modules transformed.
dist/index.html                     1.03 kB │ gzip:   0.57 kB
dist/assets/index-DVUG7LMx.css     63.93 kB │ gzip:  10.85 kB
dist/assets/index-DqYaZqrr.js   1,011.23 kB │ gzip: 265.90 kB
✓ built in 4.27s
# Exit code: 0 (Zero regressions)
```

