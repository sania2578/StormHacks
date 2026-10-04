// Shared LLM helper used by chat.js and summarize.js.
// Default provider: Gemini (key from Google AI Studio, free tier available).
// Env vars:
//   GEMINI_API_KEY   required for Gemini
//   GEMINI_MODEL     optional, default "gemini-2.5-flash"
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
          // Thinking tokens count against this limit, so leave plenty of room.
          // (A cut-off answer is invalid JSON, which showed up as "AI unavailable".)
          maxOutputTokens: Math.max(maxTokens, 4096),
          temperature: 0.3,
          // Gemini 2.5 Flash can skip "thinking" entirely: faster, cheaper, and
          // the answer is never cut short. Other models do not accept this setting.
          ...(/gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    }
  );
  if (!r.ok) throw new Error('Gemini error ' + r.status + ': ' + (await r.text()).slice(0, 300));

  const data = await r.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');

  if (!text) {
    // Blocked prompt, safety stop, or empty answer: say why in the function log
    throw new Error('Gemini returned no text (' + (data.promptFeedback?.blockReason || candidate?.finishReason || 'unknown') + ')');
  }
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini answer was cut off (MAX_TOKENS)');
  }
  return text;
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
  if (!r.ok) throw new Error('Claude error ' + r.status + ': ' + (await r.text()).slice(0, 300));
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

// The model is told to return JSON only, but sometimes adds fences or a sentence
// around it. Pull out the first { ... } block and parse that.
function parseJSON(raw) {
  const text = String(raw || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('No JSON in AI answer');
    return JSON.parse(text.slice(start, end + 1));
  }
}

module.exports = { callLLM, parseJSON };