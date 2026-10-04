// Netlify function: POST /.netlify/functions/summarize
// Generates doctor-ready clinical handoff using Gemini 1.5 Flash

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const SYSTEM_INSTRUCTION = `You are a clinical communication assistant for CarePath BC.
Your task is to take a patient's self-described symptoms (often written by newcomers/refugees in non-English languages) and create:
1. "summary_en": A structured, professional English handoff summary for a Canadian doctor/nurse (Reason for visit, Onset/duration, Severity, Relevant context, Patient questions).
2. "script_en": A short first-person script in plain English for the patient to read aloud to the clinician.
3. "script_user_lang": The exact translation of the script back into the patient's language so they know what they are saying.
Never invent symptoms not stated by the user. Do not diagnose or recommend treatments.
Respond ONLY with a valid raw JSON object:
{"summary_en": string, "script_en": string, "script_user_lang": string}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY not configured' });

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { story = '', question = '', language = 'en' } = parsed;

  const prompt = `Patient input:
- Story/Symptoms: ${story}
- Main question: ${question}
- User primary language: ${language}

Produce the structured JSON output.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return json(response.status, { error: err });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return json(200, JSON.parse(candidateText));
  } catch (err) {
    return json(500, { error: err.message || 'Internal error' });
  }
};