import 'dotenv/config';
import crypto from 'node:crypto';
import { executeQuery, executeQueryOne } from '../netlify/functions/lib/db.js';
import { signAuthToken } from '../netlify/functions/lib/auth.js';
import { handler as usersHandler } from '../netlify/functions/users.js';
import { handler as bookingsHandler } from '../netlify/functions/bookings.js';

const version = '2026-08-14';
const runId = `policy-e2e-${Date.now()}`;
const email = `${runId}@example.com`;
const coachId = crypto.randomUUID();
let clientId = null;
let bookingId = null;

process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const invoke = async (handler, path, body, token = null) => {
  const response = await handler({
    httpMethod: 'POST', path, rawUrl: `https://local.fact.test${path}`,
    headers: { origin: 'https://findacoachtoday.com', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    queryStringParameters: {}, body: JSON.stringify(body), isBase64Encoded: false
  });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
};

const assert = (condition, message, details) => {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(details)}`);
};

try {
  const baseSignup = {
    auth_mode: 'signup', email, password: 'PolicyTest!2026', full_name: 'FACT Policy Test Client', user_type: 'client'
  };
  const rejectedSignup = await invoke(usersHandler, '/api/users', baseSignup);
  assert(rejectedSignup.status === 400, 'Registration without consent was not rejected', rejectedSignup);

  const acceptedSignup = await invoke(usersHandler, '/api/users', {
    ...baseSignup, terms_accepted: true, privacy_acknowledged: true,
    adult_account_confirmed: true, policy_version: version
  });
  assert(acceptedSignup.status === 200, 'Registration with consent failed', acceptedSignup);
  clientId = acceptedSignup.body.id;

  const clientConsent = await executeQueryOne(
    `SELECT terms_version, terms_accepted_at, privacy_version,
            privacy_acknowledged_at, adult_account_confirmed_at
     FROM profiles WHERE id = $1`, [clientId]
  );
  assert(clientConsent?.terms_version === version && clientConsent?.privacy_version === version &&
    clientConsent?.terms_accepted_at && clientConsent?.privacy_acknowledged_at &&
    clientConsent?.adult_account_confirmed_at, 'Registration consent was not persisted', clientConsent);

  const coachEmail = `${runId}-coach@example.com`;
  await executeQuery(
    `INSERT INTO users (id, email, full_name, role, created_at, updated_at)
     VALUES ($1, $2, 'FACT Policy Test Coach', 'user', NOW(), NOW())`, [coachId, coachEmail]
  );
  await executeQuery(
    `INSERT INTO profiles (
       id, email, full_name, user_type, role, is_active, coach_profile,
       qualification_status, has_background_check, background_check_status,
       background_check_expires_at, created_at, updated_at
     ) VALUES ($1, $2, 'FACT Policy Test Coach', 'coach', 'user', true, $3::jsonb,
       'verified', true, 'verified', '2027-08-14', NOW(), NOW())`,
    [coachId, coachEmail, JSON.stringify({ hourly_rate: 50, services_offered: ['Technical Skills'], is_verified: true })]
  );

  const token = signAuthToken({ sub: clientId, email, user_type: 'client' });
  const booking = { coach_id: coachId, client_id: clientId, booking_date: '2026-10-15T18:00:00.000Z', duration: 60 };
  const rejectedBooking = await invoke(bookingsHandler, '/api/bookings', booking, token);
  assert(rejectedBooking.status === 400, 'Booking without policy acceptance was not rejected', rejectedBooking);

  const acceptedBooking = await invoke(bookingsHandler, '/api/bookings', {
    ...booking, cancellation_policy_accepted: true, policy_version: version
  }, token);
  assert(acceptedBooking.status === 201, 'Booking with policy acceptance failed', acceptedBooking);
  bookingId = acceptedBooking.body.id;

  const bookingConsent = await executeQueryOne(
    'SELECT policy_version, cancellation_policy_accepted_at FROM bookings WHERE id = $1', [bookingId]
  );
  assert(bookingConsent?.policy_version === version && bookingConsent?.cancellation_policy_accepted_at,
    'Booking policy acceptance was not persisted', bookingConsent);

  console.log(JSON.stringify({ passed: true, checks: [
    'registration rejects missing consent', 'registration records policy timestamps',
    'booking rejects missing policy acceptance', 'booking records cancellation-policy timestamp'
  ] }, null, 2));
} finally {
  if (bookingId) await executeQuery('DELETE FROM bookings WHERE id = $1', [bookingId]);
  if (clientId) {
    await executeQuery('DELETE FROM auth_logs WHERE user_email = $1', [email]).catch(() => {});
    await executeQuery('DELETE FROM profiles WHERE id = $1', [clientId]);
    await executeQuery('DELETE FROM users WHERE id = $1', [clientId]);
  }
  await executeQuery('DELETE FROM auth_logs WHERE user_email = $1', [email]).catch(() => {});
  await executeQuery('DELETE FROM profiles WHERE email = $1', [email]).catch(() => {});
  await executeQuery('DELETE FROM users WHERE email = $1', [email]).catch(() => {});
  await executeQuery('DELETE FROM profiles WHERE id = $1', [coachId]).catch(() => {});
  await executeQuery('DELETE FROM users WHERE id = $1', [coachId]).catch(() => {});
}

console.log('Disposable policy test records removed.');
process.exit(0);
