// Netlify function: POST /.netlify/functions/summarize
//
// Turns the Communicate form into:
//   1. a clear provider summary (English) + the same summary in the patient's language
//   2. a polished English paragraph the patient can show or read to a clinician,
//      + a translation of it so the patient knows what it says
//
// Uses the same AI settings as chat.js (see lib/llm.js).

const { callLLM, parseJSON } = require('./lib/llm');
const { withCors } = require('./lib/http');


// ===================================
// Language names (the website sends a short code)
// ===================================

const LANG_NAMES = {

  en: 'English',
  fr: 'French',
  pa: 'Punjabi',
  zh: 'Simplified Chinese',
  ar: 'Arabic',
  tl: 'Tagalog',
  ko: 'Korean',
  ja: 'Japanese',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  'zh-HK': 'Traditional Chinese (Cantonese)',
  hi: 'Hindi',
  fa: 'Persian (Farsi)',
  vi: 'Vietnamese',
  th: 'Thai'
};


// ===================================
// Allowed answers for "When did it start?"
// ===================================

const START_OPTIONS = [

  'Today',
  '1–2 days ago',
  '3–7 days ago',
  'More than a week ago'
];


// ===================================
// Instructions for the AI
// ===================================

const SYSTEM = `You help a patient who is new to the BC (Canada) health system prepare for a visit.
You receive the answers they typed into a form (possibly in a language other than English), today's date, and the language of the website interface. The doctor reads English only. The patient may not.

HARD RULES
- Use ONLY information the patient gave. Never diagnose, never guess a cause, and never add symptoms, body sides, durations, medications or requests that the patient did not state.
- If an answer is vague or one word (for example a question that just says "medication"), keep it vague and honest: "I have a question about medication." Do NOT guess what they want to ask, and do NOT ask for a prescription or treatment unless the patient wrote that.
- Empty or null fields mean "not provided". Write "Not provided" for them in the summaries and leave them out of the paragraph. Never treat them as "none". Answers like "none", "no" or "n/a" mean "None reported".
- Keep drug names exactly as written.

patient_language: the language the patient typed in. If their text is in English but interface_language is not English, use interface_language. Otherwise "English".
Interpreter: a named language or "yes" means an interpreter is requested. "no" or "none" means not requested. Empty means not provided.

Return ONLY a JSON object, no markdown fences:
{
 "summary_en": string,
   // ALWAYS English, whatever language the patient typed. Plain text, one item per line, no bullets or markdown, these lines in this order:
   // Date: <the date given>
   // Visit type: <where they are going, or Not provided>
   // Reason for visit: <one clear sentence; medical wording only where clearly accurate>
   // Onset: <when it started, or Not provided>
   // Severity: <n>/10 (patient-rated), or Not provided
   // Medications: <list, None reported, or Not provided>
   // Allergies: <list, None reported, or Not provided>   (if medications and allergies were given as one answer and cannot be split clearly, use one line "Medications/allergies: ...")
   // Patient questions: <each question as a clear full sentence, or Not provided>
   // Language: <"Primary language: X. Interpreter requested." / "Interpreter not requested." / "Interpreter request not provided."> (only when patient_language is not English)
 "summary_native": string|null,
   // The SAME content as summary_en, written in patient_language in clear, natural, well-organised wording, with the line labels translated too, so the patient can check what the doctor will read. null if patient_language is English.
 "say_en": string,
   // ALWAYS English, whatever language the patient typed. ONE polished paragraph of 4 to 7 sentences in warm, clear, correct English, first person, for the patient to show or read to the clinician.
   // Begin with a polite greeting. If patient_language is not English, say the patient is not fluent in English and wrote this to help explain (and ask for an interpreter if one is requested).
   // Then cover, only where provided: the reason for the visit, when it started, how bad it is (n out of 10), medications and allergies, and the patient's own questions.
   // End with a thank-you. No bullet points, no headings.
 "source_lang": string,   // patient_language
 "say_native": string|null,   // say_en translated faithfully into patient_language so the patient understands what they will show; null if patient_language is English
 "label_native": string|null,   // the phrase "What you will say, in your language:" translated into patient_language; null if English
 "summary_label_native": string|null   // the phrase "Your summary, in your language:" translated into patient_language; null if English
}`;


// ===================================
// Simple per-IP rate limit
// Resets when the function restarts.
// ===================================

const hits = new Map();

const MAX_REQUESTS_PER_MINUTE = 6;


// ===================================
// Helpers
// ===================================

// Build a JSON response
function json(statusCode, body) {

  return {

    statusCode: statusCode,

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify(body)
  };
}


// Trim text and cut it to a maximum length
function clean(value, maxLength = 800) {

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}


// ===================================
// Main function
// ===================================

async function handle(event) {

  // -----------------------------------
  // POST only
  // -----------------------------------

  if (event.httpMethod !== 'POST') {

    return json(405, { error: 'POST only' });
  }


  // -----------------------------------
  // Rate limiting
  // -----------------------------------

  const ip =
    event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for']
    || 'unknown';

  const now = Date.now();

  const recent =
    (hits.get(ip) || [])
      .filter(time => now - time < 60000);

  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {

    return json(429, { error: 'Too many requests. Wait a minute and try again.' });
  }

  recent.push(now);

  hits.set(ip, recent);


  // -----------------------------------
  // Read the request body
  // -----------------------------------

  let body;

  try {

    body = JSON.parse(event.body || '{}');

  } catch {

    return json(400, { error: 'Invalid JSON' });
  }


  // -----------------------------------
  // Read and clean the form answers
  // -----------------------------------

  const fields = body.fields || {};

  const severityNumber = parseInt(fields.severity, 10);

  const input = {

    date: new Date().toISOString().slice(0, 10),

    interface_language: LANG_NAMES[body.lang] || 'English',

    going_to: clean(fields.where, 200),

    what_is_happening: clean(fields.story, 3000),

    started: START_OPTIONS.includes(fields.start) ? fields.start : '',

    // null means "not provided"
    severity_out_of_10:
      Number.isFinite(severityNumber)
        ? Math.min(10, Math.max(1, severityNumber))
        : null,

    medications_and_allergies: clean(fields.meds),

    questions_for_provider: clean(fields.questions),

    interpreter_needed: clean(fields.interpreter, 100)
  };


  // -----------------------------------
  // The main story is required
  // -----------------------------------

  if (!input.what_is_happening) {

    return json(400, { error: 'Describe what is happening first.' });
  }


  try {

    // -----------------------------------
    // Ask the AI
    // -----------------------------------

    const raw = await callLLM({

      system: SYSTEM,

      messages: [
        {
          role: 'user',
          content: JSON.stringify(input)
        }
      ],

      maxTokens: 4096
    });


    // -----------------------------------
    // Read the AI's JSON answer
    // -----------------------------------

    const out = parseJSON(raw);

    if (typeof out.summary_en !== 'string' || typeof out.say_en !== 'string') {

      throw new Error('AI answer was missing required parts');
    }


    // -----------------------------------
    // Translation fields only apply when the patient is not using English
    // -----------------------------------

    const isEnglish = /^english$/i.test(String(out.source_lang || ''));

    function translatedOrNull(value) {

      if (!isEnglish && typeof value === 'string' && value.trim()) {
        return value;
      }

      return null;
    }


    // -----------------------------------
    // Send the result back to the website
    // -----------------------------------

    return json(200, {

      summary_en: out.summary_en,

      say_en: out.say_en,

      source_lang: String(out.source_lang || ''),

      summary_native: translatedOrNull(out.summary_native),

      say_native: translatedOrNull(out.say_native),

      label_native: translatedOrNull(out.label_native),

      summary_label_native: translatedOrNull(out.summary_label_native)
    });


  } catch (error) {

    // Visible in Netlify > Logs > Functions
    console.error('LLM call failed:', error.message);

    return json(502, { error: 'Could not build the summary' });
  }
}


exports.handler = withCors(handle);