# random_talks server

Small Express service that does two things the frontend must never do itself:

1. **`POST /token`** — signs ZegoCloud video call tokens using your `ZEGO_SERVER_SECRET`.
   Uses ZEGOCLOUD's own official `token04` implementation (copied verbatim from
   github.com/ZEGOCLOUD/zego_server_assistant into `lib/zegoServerAssistant.js` —
   not reimplemented from scratch, so the crypto is exactly what Zego ships).
2. **`POST /icebreaker`** — calls the Claude API server-side to generate a real,
   personalized icebreaker question from both users' interests.

Both exist because their secrets (`ZEGO_SERVER_SECRET`, `ANTHROPIC_API_KEY`) would
be stealable by anyone reading your frontend's JS bundle if called directly from
the browser.

## Setup

```bash
cd server
npm install
cp .env.example .env
# fill in .env — see below
npm start
```

## Environment variables

| Variable | Where to get it |
|---|---|
| `ZEGO_APP_ID` | ZegoCloud Console → your project → Basic Info |
| `ZEGO_SERVER_SECRET` | Same page, "ServerSecret" — 32 characters |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (only needed for `/icebreaker`; the frontend falls back to a static question list if this endpoint isn't configured) |
| `ALLOWED_ORIGIN` | Your deployed frontend's origin, e.g. `https://your-app.vercel.app`. Leave as `*` for local dev only. |

## Deploying for free

Render and Railway both have free tiers that work for this:

- **Render**: New → Web Service → connect this `server/` folder → Build command
  `npm install` → Start command `npm start` → add the env vars above.
- **Railway**: New Project → Deploy from repo → set root directory to `server/` →
  add the env vars.

Either way, once deployed, take the resulting URL (e.g. `https://random-talks-server.onrender.com`)
and set it as `VITE_SERVER_URL` in the frontend's `.env`.

## What I actually tested (and what I couldn't)

I ran this server for real in a sandboxed environment and confirmed:
- `POST /token` returns a correctly-shaped token (`04` + base64, matching Zego's spec)
  using Zego's own published sample credentials.
- `POST /token` with missing fields returns `400`, not a crash.
- `POST /icebreaker` without `ANTHROPIC_API_KEY` set returns a clean `500`, not a crash.

I could **not** test `/icebreaker` with a real Anthropic key (I don't have yours),
or `/token` against your real ZegoCloud app (same reason). Once you add your real
keys, test both yourself:

```bash
curl -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"uid":"test","roomId":"testroom"}'

curl -X POST http://localhost:3001/icebreaker \
  -H "Content-Type: application/json" \
  -d '{"myInterests":["chess"],"otherInterests":["hiking"]}'
```
