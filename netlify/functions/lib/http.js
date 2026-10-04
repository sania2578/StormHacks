// CORS wrapper. Needed when the web page and the functions live on different domains,
// e.g. page on https://sania2578.github.io and functions on https://YOUR-SITE.netlify.app
//
// Env var (optional): ALLOWED_ORIGINS = comma-separated list, e.g.
//   https://sania2578.github.io,https://yoursite.netlify.app
// Use "*" to allow any site (not recommended once real users arrive).

const DEFAULTS = ['https://sania2578.github.io', 'http://localhost:8888', 'http://127.0.0.1:5500'];

function allowedList() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULTS;
}

function corsHeaders(event) {
  const list = allowedList();
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allow = list.includes('*') ? '*' : list.includes(origin) ? origin : list[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function withCors(handler) {
  return async (event) => {
    const cors = corsHeaders(event);
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }; // browser preflight
    const res = await handler(event);
    return { ...res, headers: { ...(res.headers || {}), ...cors } };
  };
}

module.exports = { withCors };