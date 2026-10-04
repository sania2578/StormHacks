// Netlify function: POST /.netlify/functions/chat
// Setup: set GEMINI_API_KEY in Netlify > Site configuration > Environment variables
// (see lib/llm.js for all settings). The key never reaches the browser.

const { callLLM, parseJSON } = require('./lib/llm');
const { withCors } = require('./lib/http');


// ===================================
// Categories the chat can suggest
// (these must match the keys in the website's CATS list)
// ===================================

const CATS = [
  'eye',
  'cold',
  'injury',
  'skin',
  'dental',
  'stomach',
  'neuro',
  'ent',
  'musculoskeletal',
  'breathing',
  'pregnancy',
  'mental',
  'meds'
];


// ===================================
// Backup emergency check
// (runs even if the AI misses something)
// ===================================

const URGENT_RE =
  /chest pain|can'?t breathe|cannot breathe|stroke|overdose|suicid|kill myself|end my life|unconscious|seizure/i;


// ===================================
// Instructions for the AI
// ===================================

const SYSTEM = `
You are CarePath BC, a healthcare navigation assistant for people new to the BC (Canada) health system, including refugees, newcomers and older adults.

You help people decide WHERE to seek care.

You never diagnose, never name a likely condition, and never give medication doses or change prescriptions.

Rules:

1. Safety first.
If the person describes chest pain, stroke signs, severe trouble breathing, uncontrolled bleeding, seizure, loss of consciousness, overdose, sudden vision loss, chemical exposure, or thoughts of suicide or harming someone, set "urgent" to true.

Tell them to call 9-1-1, or call/text 9-8-8 for suicide crisis, in the "reply".

2. Otherwise, ask at most ONE short follow-up question if you need it, then pick the best category.

3. Categories.
Use exactly one of these keys:

eye
cold
injury
skin
dental
stomach
neuro
ent
musculoskeletal
breathing
pregnancy
mental
meds

Use null if none fits or you still need more information.

Category meanings:

eye: eye problems
cold: cough, cold, fever, sore throat
injury: sprain, fall, cut
skin: rash, urinary burning, minor infection
dental: tooth or mouth pain
stomach: abdominal pain, vomiting, diarrhea, constipation
neuro: headache, dizziness
ent: ear, nose, throat
musculoskeletal: back, muscle, joint pain
breathing: wheezing, shortness of breath, asthma
pregnancy: pregnancy or sexual health
mental: stress, low mood, crisis
meds: prescription refills or medicine questions

4. Mention 8-1-1, the HealthLink BC nurse line, when the person is unsure.

5. Write "reply" in the language the person is using.
Use plain words and 1 to 3 short sentences.

6. "summary_en":
Once you know enough, write a short neutral English description of what the person reported and when it started.

Use third person, for example:
"Patient reports..."

Otherwise return null.

Include only what the person actually said.

7. Do not ask for names, addresses or health card numbers.

8. Never include web links or URLs.
Never give any phone number except 9-1-1, 8-1-1 and 9-8-8.
Never invent clinic names or addresses.
You never replace emergency help: for emergencies always point to 9-1-1.

Respond with ONLY a JSON object.
Do not use markdown fences.

Required format:

{
  "reply": string,
  "urgent": boolean,
  "category": string|null,
  "summary_en": string|null
}
`;


// ===================================
// What the AI should know about the current tab
// ===================================

const TAB_CONTEXT = {

  navigate:
    'Navigate. They are deciding where to go for care. Focus on picking a category.',

  communicate:
    'Communicate. They are preparing to explain their problem to a provider. Help them say it clearly and fill in "summary_en".',

  manage:
    'Manage. They are tracking a medication. Explain what a label or schedule says in plain words, never change doses or timing, and refer dosing questions to their pharmacist or prescriber.',

  followup:
    'Follow up. They are checking recovery. If they say they are getting worse, tell them to re-check where to go or call 8-1-1, and set "urgent" if any emergency sign is present.'
};


// ===================================
// Simple per-IP rate limit
// Resets when the function restarts.
// Use a real data store for production.
// ===================================

const hits = new Map();

const MAX_REQUESTS_PER_MINUTE = 10;


// ===================================
// Helper: build a JSON response
// ===================================

function json(statusCode, body) {

  return {

    statusCode: statusCode,

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify(body)
  };
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
  // Read what the website sent
  //
  //   messages = the last few chat messages (what the website sends now)
  //   message + history = older format, still accepted
  // -----------------------------------

  const {
    messages = [],
    message = '',
    history = [],
    tab = 'navigate',
    lang = 'en'
  } = body;


  // -----------------------------------
  // Put the conversation into one list
  // -----------------------------------

  let rawMessages;

  if (Array.isArray(messages) && messages.length > 0) {

    rawMessages = messages;

  } else {

    rawMessages = [

      ...(Array.isArray(history) ? history : []),

      { role: 'user', content: String(message) }
    ];
  }


  // -----------------------------------
  // Clean the conversation
  // (only user/assistant text, limited length)
  // -----------------------------------

  const msgs =
    rawMessages
      .slice(-10)
      .filter(item =>
        item
        && (item.role === 'user' || item.role === 'assistant')
        && typeof item.content === 'string'
        && item.content.trim()
      )
      .map(item => ({

        role: item.role,

        content: item.content.trim().slice(0, 1500)
      }));


  // The AI needs the first message to be from the user
  while (msgs.length && msgs[0].role !== 'user') {

    msgs.shift();
  }


  if (msgs.length === 0) {

    return json(400, { error: 'Message is required' });
  }


  // -----------------------------------
  // Find the latest thing the user said
  // -----------------------------------

  const lastUser =
    [...msgs]
      .reverse()
      .find(item => item.role === 'user')
      .content;


  // -----------------------------------
  // Language
  // Supports: en, ko, fr, zh, zh-HK, etc.
  // -----------------------------------

  const safeLang =
    /^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang)
      ? lang
      : 'en';


  // -----------------------------------
  // Current app tab
  // -----------------------------------

  const safeTab =
    Object.prototype.hasOwnProperty.call(TAB_CONTEXT, tab)
      ? tab
      : 'navigate';


  try {

    // -----------------------------------
    // Ask the AI
    // -----------------------------------

    const raw = await callLLM({

      system:
        `${SYSTEM}

The app interface language is "${safeLang}".

Still respond in the language the person actually writes in.

The person is currently on this part of the app:

${TAB_CONTEXT[safeTab]}`,

      messages: msgs,

      maxTokens: 700
    });


    // -----------------------------------
    // Read the AI's JSON answer
    // -----------------------------------

    let out;

    try {

      out = parseJSON(raw);

    } catch {

      // Never show half a JSON object to the person
      out = {

        reply: /^\s*[{\[]/.test(raw) ? 'Sorry, I could not answer that. Please try again.' : (raw || 'Sorry, I could not answer that.'),

        urgent: false,

        category: null,

        summary_en: null
      };
    }


    // -----------------------------------
    // Send a clean answer back to the website
    // -----------------------------------

    return json(200, {

      reply: String(out.reply || ''),

      // Urgent if the AI says so, OR our backup word check matches
      urgent: out.urgent === true || URGENT_RE.test(lastUser),

      // Only allow categories the website knows about
      category: CATS.includes(out.category) ? out.category : null,

      summary_en:
        typeof out.summary_en === 'string'
          ? out.summary_en
          : null
    });


  } catch (error) {

    // Visible in Netlify > Logs > Functions
    console.error('LLM call failed:', error.message);

    return json(502, { error: 'AI service unreachable' });
  }
}


exports.handler = withCors(handle);