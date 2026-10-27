require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateToken04 } = require('./lib/zegoServerAssistant');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

const ZEGO_APP_ID = Number(process.env.ZEGO_APP_ID);
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Issues a short-lived ZegoCloud video token server-side, so your ServerSecret
// never has to be shipped to the browser. Uses ZEGOCLOUD's own official token04
// implementation (github.com/ZEGOCLOUD/zego_server_assistant), copied verbatim
// into lib/zegoServerAssistant.js rather than reimplemented.
app.post('/token', (req, res) => {
  const { uid, roomId } = req.body || {};
  if (!uid || !roomId) {
    return res.status(400).json({ error: 'uid and roomId are required' });
  }
  if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
    return res.status(500).json({ error: 'Server is missing ZEGO_APP_ID / ZEGO_SERVER_SECRET' });
  }
  try {
    const effectiveTimeInSeconds = 3600;
    const payload = JSON.stringify({
      room_id: roomId,
      privilege: { 1: 1, 2: 1 }, // 1 = login room, 2 = publish stream — both allowed
      stream_id_list: null,
    });
    const token = generateToken04(ZEGO_APP_ID, uid, ZEGO_SERVER_SECRET, effectiveTimeInSeconds, payload);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Token generation failed' });
  }
});

// Generates a real, personalized icebreaker via the Claude API — replaces the
// hardcoded 4-question array from the original project.
app.post('/icebreaker', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }
  const { myInterests = [], otherInterests = [] } = req.body || {};
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        messages: [
          {
            role: 'user',
            content:
              `Two strangers are on a random video chat. Person A likes: ${myInterests.join(', ') || 'unknown'}. ` +
              `Person B likes: ${otherInterests.join(', ') || 'unknown'}. Write exactly one short, casual ` +
              `icebreaker question (under 20 words) they could ask each other. Reply with only the question, no preamble.`,
          },
        ],
      }),
    });
    const data = await resp.json();
    const question = data?.content?.find((b) => b.type === 'text')?.text?.trim();
    if (!question) throw new Error('No question returned: ' + JSON.stringify(data));
    res.json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Icebreaker generation failed' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
