# random_talks

Stranger video chat app — React + Firebase + ZegoCloud, plus a small backend for
anything that needs a secret kept off the client.

## What's real in this build

- **Matchmaking**: Firestore transaction-based queue, mutual gender filtering,
  block-aware (won't match you with someone you've blocked or who blocked you),
  stale-entry filtering, dual detection (active polling + realtime listener).
- **Auth**: real email/password sign-up, sign-in, and logout (not anonymous
  one-click auth).
- **Age gate**: hard-blocks profile creation under 18, requires an explicit
  confirmation checkbox.
- **Text chat**: real-time, per-call, Firestore-backed, only visible to the two
  participants (enforced by security rules, not just UI).
- **Report & block**: report reasons + optional block, block is enforced in the
  matchmaking query itself, not just cosmetically.
- **Live captions**: real browser speech-to-text (Web Speech API) of *your own*
  mic — free, no key. Does not caption the other person; see caveat below.
- **AI icebreaker**: real Claude API call using both users' interests, via the
  `server/` backend. Falls back to a static question if the backend isn't configured.
- **Video tokens**: signed server-side via ZegoCloud's official token04 algorithm,
  if `server/` is deployed and `VITE_SERVER_URL` is set. Falls back to Zego's
  insecure client-side test-token generator otherwise (dev only — flagged
  on-screen with a "Dev Mode" badge when active).

## What's still not real / known limitations

- **No friends system.** The sidebar says so honestly rather than showing fake data.
- **Remote-peer captioning isn't possible without a paid speech-to-text API** —
  browsers can only transcribe local mic audio, not the other person's stream.
- **Age gate is self-attestation.** It stops casual under-18 sign-ups, not a
  determined liar. Real ID verification (Persona, Stripe Identity, Yoti) is a
  paid add-on if you need stronger guarantees.
- **Client-side matchmaking has a griefing vector**: any authenticated user can
  technically flip another user's queue status via the Firestore rules that make
  matching possible at all. Documented in `firestore.rules`. Move matching into
  a Cloud Function (requires Firebase's Blaze plan) to close this if it becomes
  a real problem.
- **No automated moderation** (e.g. auto-suspend after N reports). Reports land
  in Firestore for manual review only.

## Setup

1. **Firebase**
   - Create a project at console.firebase.google.com if you haven't.
   - Authentication → Sign-in method → enable **Email/Password**.
   - Firestore → create database → paste `firestore.rules` into the Rules tab (or
     `firebase deploy --only firestore:rules` with the CLI).
   - Project Settings → General → your web app → copy the config values into
     `.env` (see `.env.example`).

2. **Frontend**
   ```bash
   npm install
   cp .env.example .env   # fill in your Firebase values
   npm run dev
   ```

3. **Backend (optional but recommended before real use)** — see `server/README.md`.
   Needed for: production-safe video tokens, real AI icebreakers. Without it the
   app still runs, using Zego's dev-only test tokens and a static icebreaker list.

## What I actually tested, and how

I don't have your Firebase project or ZegoCloud credentials, and this sandbox
doesn't have live network access to Firestore or the ZegoCloud realtime APIs —
so I could not run a live two-browser matchmaking session or a live video call
here. What I *did* verify directly, in this environment:

- `npm install` succeeds with no dependency conflicts.
- `npm run lint` is clean — found and fixed two real bugs in the process: the
  original `eslint.config.js` referenced a plugin API (`reactHooks.configs.flat.recommended`)
  that doesn't exist in the installed version, and the config had no way to
  recognize JSX component usage at all, which would have thrown ~50 false
  "unused variable" errors on every icon/component import project-wide.
- `npm run build` succeeds and produces a working `dist/` bundle.
- The `server/` Express app boots, and I hit `/token`, `/health`, and `/icebreaker`
  over real HTTP requests — `/token` returns a correctly-shaped Zego token using
  their own published sample credentials; error paths (missing fields, missing
  API key) return clean error responses instead of crashing.

**What you need to test yourself, because I can't:** open the app in two separate
browser sessions (or one normal + one incognito), sign up two accounts, and confirm
they actually match each other and connect on video — that's the one thing that
genuinely requires two real humans or two real browser instances against your
live Firebase project, which I don't have access to.

## Keys/accounts you need

| What | Where |
|---|---|
| Firebase config | Firebase Console → Project Settings (already scaffolded, just needs your values in `.env`) |
| ZegoCloud AppID + ServerSecret | ZegoCloud Console → your project |
| Anthropic API key (optional, for real AI icebreakers) | console.anthropic.com |
