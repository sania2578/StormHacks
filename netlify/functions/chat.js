// Netlify function: POST /.netlify/functions/chat
// Uses free-tier Gemini API with server-side GEMINI_API_KEY

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const SYSTEM_INSTRUCTION = `You are CarePath BC, a healthcare navigation assistant for people new to the BC (Canada) health system, including refugees, newcomers and older adults.
You help people decide WHERE to seek care. You never diagnose, never name a likely condition, and never give medication doses or change prescriptions.
Rules:
1. Safety first. If the person describes chest pain, stroke signs, severe trouble breathing, uncontrolled bleeding, seizure, loss of consciousness, overdose, sudden vision loss, chemical exposure, or thoughts of suicide or harming someone, set "urgent" to true. Tell them to call 9-1-1 (or call/text 9-8-8 for suicide crisis) in the "reply".
2. Otherwise, ask at most ONE short follow-up question if you need it, then pick the best category.
3. Categories (use exactly these keys): eye, cold, injury, skin, dental, mental, meds. Use null if none fits or you still need more information.
4. Mention 8-1-1 (HealthLink BC nurse line) when the person is unsure.
5. Write "reply" in the language the person is using. Use plain words, 1 to 3 short sentences.
6. "summary_en": once you know enough, write a short neutral English description of what the person reported and when it started, in the third person ("Patient reports..."). Otherwise null. Include only what the person actually said.
7. Do not ask for names, addresses or health card numbers.
Respond with ONLY valid raw JSON without markdown code fences:
{"reply": string, "urgent": boolean, "category": string|null, "summary_en": string|null}`;

const hits = new Map();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 10) return json(429, { error: 'Too many requests. Please wait a minute.' });
  recent.push(now);
  hits.set(ip, recent);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY not configured on server' });

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const {
    message = '',
    history = [],
    tab = 'navigate',
    lang = 'en'
  } = parsed;

  if (!message.trim()) {
    return json(400, {
      error: 'Message is required'
    });
  }

  const promptText = `User current tab context: ${tab}
  User selected language: ${lang}

  Conversation history:
  ${history
    .map(h => `${h.role}: ${h.content}`)
    .join('\n')}

  User message: ${message}

  Remember to respond with strictly valid raw JSON:
  {"reply": string, "urgent": boolean, "category": string|null, "summary_en": string|null}`;

  // Map conversation into Gemini prompt format
  const promptText = `User current tab context: ${tab}
Conversation history:
${history.map(h => `${h.role}:${h.content}`).join('\n')}
User message: ${message}

Remember to respond with strictly valid raw JSON:
{"reply": string, "urgent": boolean, "category": string|null, "summary_en": string|null}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return json(response.status, { error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return json(200, JSON.parse(candidateText));
  } catch (err) {
    return json(500, { error: err.message || 'Internal error' });
  }
};