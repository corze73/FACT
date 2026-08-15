import 'dotenv/config';
import crypto from 'node:crypto';
import { executeQuery, executeQueryOne } from '../netlify/functions/lib/db.js';
import { handler as usersHandler } from '../netlify/functions/users.js';

const id = crypto.randomUUID();
const email = `password-reset-e2e-${Date.now()}@example.com`;
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

const invoke = async (path, body) => {
  const response = await usersHandler({
    httpMethod: 'POST', path, rawUrl: `https://local.fact.test${path}`,
    headers: { origin: 'https://findacoachtoday.com' }, queryStringParameters: {},
    body: JSON.stringify(body), isBase64Encoded: false
  });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
};

const assert = (condition, message, details) => {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(details)}`);
};

try {
  await executeQuery(
    `INSERT INTO users (id, email, full_name, role, password_reset_token_hash,
       password_reset_expires_at, created_at, updated_at)
     VALUES ($1, $2, 'FACT Password Reset Test', 'user', $3, NOW() + INTERVAL '1 hour', NOW(), NOW())`,
    [id, email, tokenHash]
  );
  await executeQuery(
    `INSERT INTO profiles (id, email, full_name, user_type, role, is_active, created_at, updated_at)
     VALUES ($1, $2, 'FACT Password Reset Test', 'client', 'user', true, NOW(), NOW())`, [id, email]
  );

  const unknown = await invoke('/api/users/forgot-password', { email: `unknown-${email}` });
  assert(unknown.status === 200 && unknown.body?.success === true,
    'Unknown-email response leaked account existence', unknown);

  const weak = await invoke('/api/users/reset-password', { token: rawToken, newPassword: 'short' });
  assert(weak.status === 400, 'Weak reset password was accepted', weak);

  const reset = await invoke('/api/users/reset-password', { token: rawToken, newPassword: 'ResetSecure!2026' });
  assert(reset.status === 200 && reset.body?.success === true && reset.body?.token,
    'Valid reset failed', reset);

  const used = await invoke('/api/users/reset-password', { token: rawToken, newPassword: 'AnotherSecure!2026' });
  assert(used.status === 400, 'Reset token was reusable', used);

  const signin = await invoke('/api/users', {
    auth_mode: 'signin', email, password: 'ResetSecure!2026'
  });
  assert(signin.status === 200 && signin.body?.token, 'New password could not sign in', signin);

  const stored = await executeQueryOne(
    'SELECT password_reset_token_hash, password_reset_expires_at FROM users WHERE id = $1', [id]
  );
  assert(stored && stored.password_reset_token_hash === null && stored.password_reset_expires_at === null,
    'Reset token was not cleared', stored);

  console.log(JSON.stringify({ passed: true, checks: [
    'unknown email remains private', 'weak password rejected', 'valid reset succeeds',
    'reset token is single-use', 'new password signs in', 'reset token fields cleared'
  ] }, null, 2));
} finally {
  await executeQuery('DELETE FROM auth_logs WHERE user_email = $1', [email]).catch(() => {});
  await executeQuery('DELETE FROM profiles WHERE id = $1', [id]).catch(() => {});
  await executeQuery('DELETE FROM users WHERE id = $1', [id]).catch(() => {});
}

console.log('Disposable password-reset test account removed.');
process.exit(0);
