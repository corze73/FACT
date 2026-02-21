import 'dotenv/config';

const url = process.env.PHASE4_HEADERS_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
const response = await fetch(url, { method: 'GET' });

const wanted = [
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'content-security-policy',
  'x-frame-options'
];

const headers = {};
for (const key of wanted) {
  headers[key] = response.headers.get(key);
}

console.log(JSON.stringify({
  url,
  status: response.status,
  headers
}, null, 2));
