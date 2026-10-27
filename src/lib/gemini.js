/**
 * Gemini 1.5 Flash API Engine for RandomTalks Pro
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const FALLBACK_ICEBREAKERS = {
  professional: [
    "What's an exciting project or tech stack you're currently exploring?",
    "If you could launch any startup today with unlimited funding, what problem would it solve?",
    "What's one non-obvious skill that helped you most in your career?",
    "What's the best advice you've ever received from a mentor or peer?",
  ],
  study: [
    "What topic or subject are you focused on mastering this week?",
    "What's your most effective study habit or deep-work productivity hack?",
    "If you could have dinner with any historic scientist, founder, or thinker, who would it be?",
  ],
  language: [
    "What language are you learning right now, and what's the hardest part so far?",
    "What's a phrase or idiom in your native language that doesn't translate easily?",
    "Which country's culture or cuisine would you love to immerse yourself in next?",
  ],
  deeptalk: [
    "What is a personal belief or philosophy that has changed for you over the past few years?",
    "What does a truly meaningful day look like to you?",
    "What is something you wish more people understood about you?",
  ],
  gaming: [
    "What is your all-time favorite gaming memory or game storyline?",
    "What game are you most hyped to play this season?",
    "Co-op strategy or competitive FPS: what's your ultimate gaming vibe?",
  ],
  casual: [
    "If you could teleport to any city or hidden spot right now, where would you go?",
    "What is a random rabbit hole you went down recently on YouTube or Reddit?",
    "What's your ultimate comfort food or weekend routine?",
    "What song or podcast has been on repeat for you lately?",
  ],
};

export const FALLBACK_TIPS = [
  "✨ Tip: Say a warm hello right away — first impressions spark great conversations!",
  "🛡️ Community Rule: Keep it respectful and polite. We maintain a zero-tolerance policy for toxicity.",
  "💡 Icebreaker Idea: Ask about their city, current passion project, or favorite hobby.",
  "⚡ Pro Tip: Use Quick Notes in the dock to jot down shared ideas and project links.",
  "🤝 Connection Goal: If you hit it off, hit 'Add Friend' to stay connected for direct calls!",
];

/**
 * Generate 1 engaging conversation question based on room mode & optional interests
 */
export async function generateIcebreaker(mode = 'casual', myInterests = [], otherInterests = []) {
  const modeKey = mode.toLowerCase();
  const pool = FALLBACK_ICEBREAKERS[modeKey] || FALLBACK_ICEBREAKERS.casual;
  const fallback = pool[Math.floor(Math.random() * pool.length)];

  if (!GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const prompt = `You are a conversational AI for a stranger video chat app called RandomTalks Pro.
Generate exactly ONE short, friendly, open-ended, and punchy icebreaker question for two strangers who just matched in "${mode}" mode.
${myInterests?.length ? `User interests: ${myInterests.join(', ')}.` : ''}
${otherInterests?.length ? `Partner interests: ${otherInterests.join(', ')}.` : ''}
Return ONLY the question text (max 20 words) with no quotes, greetings, or prefixes.`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 60,
          temperature: 0.8,
        },
      }),
    });

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return candidate ? candidate.replace(/^["']|["']$/g, '') : fallback;
  } catch (err) {
    console.warn('[Gemini] Icebreaker generation fallback used:', err);
    return fallback;
  }
}

/**
 * Generate 5 witty conversation rules and waiting tips for the matchmaking screen
 */
export async function generateMatchmakingTips() {
  if (!GEMINI_API_KEY) {
    return FALLBACK_TIPS;
  }

  try {
    const prompt = `Generate 5 short, witty, inspiring, and friendly tips & etiquette rules for users waiting in a video chat matchmaking queue.
Rules:
- Each tip should start with an emoji (e.g. ✨, 💡, 🛡️, ⚡, 🤝).
- Keep each tip under 15 words.
- Format output as exactly 5 JSON strings in a JSON array: ["tip 1", "tip 2", "tip 3", "tip 4", "tip 5"].
Return ONLY the raw JSON array, nothing else.`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      return FALLBACK_TIPS;
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) return FALLBACK_TIPS;

    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5);
    }
    return FALLBACK_TIPS;
  } catch (err) {
    console.warn('[Gemini] Matchmaking tips fallback used:', err);
    return FALLBACK_TIPS;
  }
}
