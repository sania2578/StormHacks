// Netlify function: POST /.netlify/functions/summarize
// Uses the same provider settings as chat.js (see lib/llm.js).

const { callLLM } = require('./lib/llm');
const { withCors } = require('./lib/http');

const SYSTEM = `You help a patient who is new to the BC (Canada) health system prepare for a visit.
You receive the answers they typed into a form, possibly in a language other than English.
You never diagnose, never guess a condition, and never add facts the person did not give.

Return ONLY a JSON object, no markdown fences:
{
 "summary_en": string,      // neat plain-text clinical summary in English, one item per line, in this order, skipping items with no information:
                            // "Reason for visit: ...", "Onset: ...", "Severity: n/10", "Medications/allergies: ...", "Patient questions: ...", "Language support: ..."
                           // Short, factual, chronological, medical wording where it is clearly accurate. Keep drug names exactly as given. If something is unclear, write "unclear" instead of guessing.
 "say_en": string,          // 2 to 4 short, simple sentences in English, first person, that the patient can read aloud to the clinician. Include their main question(s).
 "source_lang": string,     // name of the language the patient wrote in, e.g. "Punjabi", or "English"
 "say_native": string|null, // the same words as say_en translated into source_lang so the patient understands what they will say. null if source_lang is English.
 "label_native": string|null // the phrase "What you will say, in your language:" translated into source_lang. null if source_lang is English.
}`;

const START = ['Today', '1–2 days ago', '3–7 days ago', 'More than a week ago'];
const hits = new Map();
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const clean = (v, n = 800) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function handle(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 6) return json(429, { error: 'Too many requests. Wait a minute and try again.' });
  recent.push(now);
  hits.set(ip, recent);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const f = body.fields || {};
  const sev = Math.min(10, Math.max(1, parseInt(f.severity, 10) || 5));
  const input = {
    going_to: clean(f.where, 200),
    what_is_happening: clean(f.story),
    started: START.includes(f.start) ? f.start : '',
    severity_out_of_10: sev,
    medications_and_allergies: clean(f.meds),
    questions_for_provider: clean(f.questions),
    interpreter_needed: clean(f.interpreter, 100),
  };
  if (!input.what_is_happening) return json(400, { error: 'Describe what is happening first.' });

  try {
    const raw = await callLLM({
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
      maxTokens: 1200,
    });
    const out = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (typeof out.summary_en !== 'string' || typeof out.say_en !== 'string') throw new Error('bad shape');

    const english = /^english$/i.test(String(out.source_lang || ''));
    return json(200, {
      summary_en: out.summary_en,
      say_en: out.say_en,
      source_lang: String(out.source_lang || ''),
      say_native: !english && typeof out.say_native === 'string' ? out.say_native : null,
      label_native: !english && typeof out.label_native === 'string' ? out.label_native : null,
    });
  } catch (e) {
    console.error('LLM call failed:', e.message); // visible in Netlify > Logs > Functions
    return json(502, { error: 'Could not build the summary' });
  }
};

exports.handler = withCors(handle);