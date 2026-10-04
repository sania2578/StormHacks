// Netlify function: POST /.netlify/functions/summarize
// Turns the Communicate form into (1) a clear provider summary and (2) a polished English
// paragraph the patient can show or read to a clinician, plus a translation back for the patient.
// Uses the same provider settings as chat.js (see lib/llm.js).

const { callLLM } = require('./lib/llm');
const { withCors } = require('./lib/http');

const LANG_NAMES = {
  en: 'English', fr: 'French', pa: 'Punjabi', zh: 'Simplified Chinese', ar: 'Arabic', tl: 'Tagalog',
  ko: 'Korean', ja: 'Japanese', es: 'Spanish', pt: 'Portuguese', ru: 'Russian',
};

const SYSTEM = `You help a patient who is new to the BC (Canada) health system prepare for a visit.
You receive the answers they typed into a form (possibly in a language other than English), today's date, and the language of the website interface.

HARD RULES
- Use ONLY information the patient gave. Never diagnose, never guess a cause, and never add symptoms, body sides, durations, medications or requests that the patient did not state.
- If an answer is vague or a single word (for example a question that just says "medication"), keep it vague and honest: "I have a question about medication." Do NOT guess what they want to ask, and do NOT ask for a prescription or treatment unless the patient wrote that.
- Translate everything into natural, correct English. Keep drug names exactly as written.
- Treat answers like "none", "no" or "n/a" as "none reported".

patient_language: the language the patient typed in. If their text is in English but interface_language is not English, use interface_language. Otherwise use "English".
Interpreter: if the interpreter answer names a language, an interpreter is requested for that language. If it says no/none or is empty, no interpreter is requested.

Return ONLY a JSON object, no markdown fences:
{
 "summary_en": string,
   // Plain text, one item per line, no bullets or markdown. Use these lines in this order and leave out a line only when there is truly no information for it:
   // Date: <the date given>
   // Visit type: <where they are going>
   // Reason for visit: <one clear sentence; medical wording only where clearly accurate>
   // Onset: <when it started>
   // Severity: <n>/10 (patient-rated)
   // Medications: <list, or "None reported">
   // Allergies: <list, or "None reported">   (if medications and allergies were given as one answer and cannot be split clearly, use one line "Medications/allergies: ...")
   // Patient questions: <each question as a clear full sentence, or "None">
   // Language: <"Primary language: X. Interpreter requested." or "Primary language: X. Interpreter not requested."> (only when patient_language is not English)
 "say_en": string,
   // ONE polished paragraph of 4 to 7 sentences in warm, clear, correct English, first person, for the patient to show or read to the clinician.
   // Begin with a polite greeting. If patient_language is not English, say the patient is not fluent in English and wrote this to help explain (and ask for an interpreter if one is requested).
   // Then cover: the reason for the visit, when it started, how bad it is (n out of 10), medications and allergies, and the patient's own questions (only those given).
   // End with a thank-you. No bullet points, no headings.
 "source_lang": string,   // patient_language
 "say_native": string|null,   // say_en translated faithfully into patient_language so the patient understands what they will show; null if patient_language is English
 "label_native": string|null  // the phrase "What you will say, in your language:" translated into patient_language; null if patient_language is English
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
    date: new Date().toISOString().slice(0, 10),
    interface_language: LANG_NAMES[body.lang] || 'English',
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
      maxTokens: 1500,
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
}

exports.handler = withCors(handle);