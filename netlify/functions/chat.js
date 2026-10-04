// Netlify function: POST /.netlify/functions/chat
// Setup: set ANTHROPIC_API_KEY in Netlify > Site settings > Environment variables.
// Optional: CLAUDE_MODEL (defaults below). The key never reaches the browser.

const CATS = ['eye', 'cold', 'injury', 'skin', 'dental', 'mental', 'meds'];
const URGENT_RE = /chest pain|can'?t breathe|cannot breathe|stroke|overdose|suicid|kill myself|end my life|unconscious|seizure/i;

const SYSTEM = `You are CarePath BC, a healthcare navigation assistant for people new to the BC (Canada) health system, including refugees, newcomers and older adults.
You help people decide WHERE to seek care. You never diagnose, never name a likely condition, and never give medication doses or change prescriptions.

Rules:
1. Safety first. If the person describes chest pain, stroke signs, severe trouble breathing, uncontrolled bleeding, seizure, loss of consciousness, overdose, sudden vision loss, chemical exposure, or thoughts of suicide or harming someone, set "urgent" to true. Tell them to call 9-1-1 (or call/text 9-8-8 for suicide crisis) in the "reply".
2. Otherwise, ask at most ONE short follow-up question if you need it, then pick the best category.
3. Categories (use exactly these keys): eye, cold, injury, skin, dental, mental, meds. Use null if none fits or you still need more information.
4. Mention 8-1-1 (HealthLink BC nurse line) when the person is unsure.
5. Write "reply" in the language the person is using. Use plain words, 1 to 3 short sentences.
6. "summary_en": once you know enough, write a short neutral English description of what the person reported and when it started, in the third person ("Patient reports..."). Otherwise null. Include only what the person actually said.
7. Do not ask for names, addresses or health card numbers.

Respond with ONLY a JSON object, no markdown fences:
{"reply": string, "urgent": boolean, "category": string|null, "summary_en": string|null}`;

const TAB_CONTEXT = {
  navigate: 'Navigate. They are deciding where to go for care. Focus on picking a category.',
  communicate: 'Communicate. They are preparing to explain their problem to a provider. Help them say it clearly and fill in "summary_en".',
  manage: 'Manage. They are tracking a medication. Explain what a label or schedule says in plain words, never change doses or timing, and refer dosing questions to their pharmacist or prescriber.',
  followup: 'Follow up. They are checking recovery. If they say they are getting worse, tell them to re-check where to go or call 8-1-1, and set "urgent" if any emergency sign is present.',
};

const hits = new Map(); // simple per-IP rate limit (resets on cold start; use a real store in production)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 10) return json(429, { error: 'Too many requests. Wait a minute and try again.' });
  recent.push(now);
  hits.set(ip, recent);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const msgs = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-10)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) return json(400, { error: 'No message' });

  const lang = /^[a-z]{2}$/.test(body.lang) ? body.lang : 'en';
  const tab = Object.prototype.hasOwnProperty.call(TAB_CONTEXT, body.tab) ? body.tab : 'navigate';
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user').content;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
        max_tokens: 600,
        system: `${SYSTEM}\nThe app interface language is "${lang}". Still match the language the person writes in.\nThe person is currently on this part of the app: ${TAB_CONTEXT[tab]}`,
        messages: msgs,
      }),
    });
    if (!r.ok) return json(502, { error: 'AI service error' });

    const data = await r.json();
    const raw = (data.content || []).find((b) => b.type === 'text')?.text || '';
    let out;
    try {
      out = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      out = { reply: raw || 'Sorry, I could not answer that.', urgent: false, category: null, summary_en: null };
    }

    return json(200, {
      reply: String(out.reply || ''),
      urgent: out.urgent === true || URGENT_RE.test(lastUser), // keyword backup in case the model misses it
      category: CATS.includes(out.category) ? out.category : null,
      summary_en: typeof out.summary_en === 'string' ? out.summary_en : null,
    });
  } catch {
    return json(502, { error: 'AI service unreachable' });
  }
};