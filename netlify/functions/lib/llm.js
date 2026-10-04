// Shared LLM helper used by chat.js and summarize.js.
// Default provider: Gemini (key from Google AI Studio, free tier available).
// Env vars:
//   GEMINI_API_KEY   required for Gemini
//   GEMINI_MODEL     optional, default "gemini-3.5-flash"
//   LLM_PROVIDER     optional, set to "claude" to use Anthropic instead
//   ANTHROPIC_API_KEY / CLAUDE_MODEL  only needed when LLM_PROVIDER=claude

async function callGemini({ system, messages, maxTokens }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: Math.max(maxTokens, 2048), // headroom in case the model spends tokens thinking
          temperature: 0.3,
        },
      }),
    }
  );
  if (!r.ok) throw new Error('Gemini error ' + r.status + ': ' + (await r.text()).slice(0, 300));

  const data = await r.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
}

async function callClaude({ system, messages, maxTokens }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!r.ok) throw new Error('Claude error ' + r.status);
  const data = await r.json();
  return (data.content || []).find((b) => b.type === 'text')?.text || '';
}

// Returns the model's raw text (both callers ask for a JSON object).
async function callLLM({ system, messages, maxTokens = 800 }) {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  return provider === 'claude'
    ? callClaude({ system, messages, maxTokens })
    : callGemini({ system, messages, maxTokens });
}

module.exports = { callLLM };
