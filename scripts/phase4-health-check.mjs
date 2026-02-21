import 'dotenv/config';

const base = process.env.PHASE4_BASE_URL || 'http://localhost:8888';
const url = `${base}/.netlify/functions/health`;

const response = await fetch(url);
const body = await response.json().catch(() => ({}));

console.log(JSON.stringify({
  endpoint: url,
  status: response.status,
  ok: response.ok,
  fields: {
    status: body.status,
    app: body.app,
    db: body.db,
    stripe: body.stripe,
    runtime: body.runtime
  }
}, null, 2));
