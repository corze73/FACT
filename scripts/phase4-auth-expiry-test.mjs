import 'dotenv/config';
import { signAuthToken } from '../netlify/functions/lib/auth.js';
import { executeQueryOne } from '../netlify/functions/lib/db.js';

const base = process.env.PHASE4_BASE_URL || 'http://localhost:8888';

const user = await executeQueryOne(
  "SELECT id, email, user_type FROM profiles WHERE user_type IN ('client','coach','admin') LIMIT 1",
  []
);

if (!user?.id) {
  throw new Error('No user found for auth expiry test');
}

const expiredToken = signAuthToken(
  { sub: user.id, email: user.email, user_type: user.user_type },
  { expiresInSeconds: -10 }
);

const url = `${base}/.netlify/functions/users/${user.id}`;
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
