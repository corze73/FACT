import 'dotenv/config';
import { signAuthToken } from '../netlify/functions/lib/auth.js';

const base = process.env.PHASE4_BASE_URL || 'http://localhost:8888';

const expiredToken = signAuthToken(
  {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'expired-session-test@example.com',
    user_type: 'admin'
  },
  { expiresInSeconds: -10 }
);

const url = `${base}/.netlify/functions/users/auth-logs`;
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${expiredToken}`
  }
});

const body = await response.json().catch(() => ({}));

console.log(JSON.stringify({
  endpoint: url,
  status: response.status,
  expected_status: 401,
  passes: response.status === 401,
  body
}, null, 2));

if (response.status !== 401) process.exitCode = 1;
