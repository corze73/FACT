import 'dotenv/config';
import crypto from 'node:crypto';
import { executeQuery, executeQueryOne } from '../netlify/functions/lib/db.js';
import { signAuthToken } from '../netlify/functions/lib/auth.js';
import { handler as safeguardingHandler } from '../netlify/functions/safeguarding.js';
import { handler as adminOpsHandler } from '../netlify/functions/admin-ops.js';
import { handler as bookingsHandler } from '../netlify/functions/bookings.js';
import { handler as usersHandler } from '../netlify/functions/users.js';

const baseUrl = process.argv[2] || 'https://deploy-preview-10--findacoachtoday.netlify.app';
const runId = `safeguarding-e2e-${Date.now()}`;
const ids = { admin: crypto.randomUUID(), client: crypto.randomUUID(), coach: crypto.randomUUID() };
const createdBookingIds = [];
let caseId = null;

const tokenFor = (id, email, userType) => signAuthToken({ sub: id, email, user_type: userType });
const request = async (path, token, options = {}) => {
  if (token) {
    const url = new URL(path, 'https://local.fact.test');
    const functionName = url.pathname.split('/').filter(Boolean)[1];
    const handlers = {
      safeguarding: safeguardingHandler,
      'admin-ops': adminOpsHandler,
      bookings: bookingsHandler,
      users: usersHandler
    };
    const handler = handlers[functionName];
    if (!handler) throw new Error(`No local test handler for ${functionName}`);
    const response = await handler({
      httpMethod: options.method || 'GET',
      path: url.pathname,
      rawUrl: url.toString(),
      headers: { authorization: `Bearer ${token}`, origin: 'https://findacoachtoday.com' },
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      body: options.body || null,
      isBase64Encoded: false
    });
    let parsed = null;
    try { parsed = response.body ? JSON.parse(response.body) : null; } catch { parsed = response.body; }
    return { status: response.statusCode, body: parsed };
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
};

const assert = (condition, message, details) => {
  if (!condition) throw new Error(`${message}${details ? `: ${JSON.stringify(details)}` : ''}`);
};

const rowsFrom = (response) => Array.isArray(response?.body)
  ? response.body
  : (Array.isArray(response?.body?.data) ? response.body.data : []);

const cleanup = async () => {
  if (caseId) await executeQuery('DELETE FROM admin_action_logs WHERE metadata->>\'case_id\' = $1', [caseId]);
  await executeQuery('DELETE FROM admin_cases WHERE created_by = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])', [[ids.admin, ids.client, ids.coach]]);
  await executeQuery('DELETE FROM admin_action_logs WHERE actor_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])', [[ids.admin, ids.client, ids.coach]]);
  await executeQuery('DELETE FROM bookings WHERE client_id = $1 OR coach_id = $2', [ids.client, ids.coach]);
  await executeQuery('DELETE FROM profiles WHERE id = ANY($1::uuid[])', [[ids.admin, ids.client, ids.coach]]);
  await executeQuery('DELETE FROM users WHERE id = ANY($1::uuid[])', [[ids.admin, ids.client, ids.coach]]);
};

try {
  for (const [kind, id] of Object.entries(ids)) {
    const email = `${runId}-${kind}@example.com`;
    const userType = kind === 'admin' ? 'admin' : kind;
    await executeQuery(
      `INSERT INTO users (id, email, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [id, email, `FACT ${kind} safety test`, kind === 'admin' ? 'admin' : 'user']
    );
    await executeQuery(
      `INSERT INTO profiles (
         id, email, full_name, user_type, role, admin_scope, is_active,
         country, city, coach_profile, qualification_status,
         has_background_check, background_check_status, background_check_expires_at,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, true,
         'United Kingdom', 'Aylesbury', $7::jsonb, $8,
         $9, $10, $11, NOW(), NOW()
       )`,
      [
        id, email, `FACT ${kind} safety test`, userType,
        kind === 'admin' ? 'admin' : 'user', kind === 'admin' ? 'full' : 'full',
        JSON.stringify(kind === 'coach' ? { hourly_rate: 50, services_offered: ['Technical Skills'], is_verified: true } : {}),
        kind === 'coach' ? 'verified' : 'pending',
        kind === 'coach', kind === 'coach' ? 'verified' : 'pending',
        kind === 'coach' ? '2027-08-14' : null
      ]
    );
  }

  const adminToken = tokenFor(ids.admin, `${runId}-admin@example.com`, 'admin');
  const clientToken = tokenFor(ids.client, `${runId}-client@example.com`, 'client');
  const coachToken = tokenFor(ids.coach, `${runId}-coach@example.com`, 'coach');

  const visibleBefore = await request('/api/users?type=coach&limit=50&offset=0');
  assert(visibleBefore.status === 200 && rowsFrom(visibleBefore).some((coach) => coach.id === ids.coach), 'Verified coach was not visible before suspension', visibleBefore);

  const bookingBefore = await request('/api/bookings', clientToken, {
    method: 'POST',
    body: JSON.stringify({ coach_id: ids.coach, client_id: ids.client, booking_date: '2026-09-15T18:00:00.000Z', duration: 60, cancellation_policy_accepted: true, policy_version: '2026-08-14' })
  });
  assert(bookingBefore.status === 201, 'Booking should succeed before suspension', bookingBefore);
  createdBookingIds.push(bookingBefore.body.id);

  const shortReport = await request('/api/safeguarding', clientToken, {
    method: 'POST', body: JSON.stringify({ category: 'physical_safety', description: 'Too short' })
  });
  assert(shortReport.status === 400, 'Short concern description should be rejected', shortReport);

  const report = await request('/api/safeguarding', clientToken, {
    method: 'POST',
    body: JSON.stringify({
      category: 'physical_safety',
      description: 'Automated safeguarding test concern with sufficient detail for administrator review.',
      immediate_danger: true,
      contact_permission: true,
      subject_user_id: ids.coach,
      booking_id: bookingBefore.body.id
    })
  });
  assert(report.status === 201 && report.body?.data?.priority === 'critical', 'Urgent concern should create a critical case', report);
  caseId = report.body.data.id;

  const cases = await request('/api/admin-ops/cases?status=open&limit=100', adminToken);
  assert(cases.status === 200 && cases.body?.data?.some((entry) => entry.id === caseId), 'Administrator could not see safeguarding case', cases);

  const suspension = await request(`/api/admin-ops/cases/${caseId}`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'in_progress', priority: 'critical', suspend_target: true,
      suspension_reason: 'Automated safeguarding test suspension pending investigation'
    })
  });
  assert(suspension.status === 200 && suspension.body?.data?.target_suspended === true, 'Safeguarding suspension failed', suspension);

  const visibleAfter = await request('/api/users?type=coach&limit=50&offset=0');
  assert(visibleAfter.status === 200 && !rowsFrom(visibleAfter).some((coach) => coach.id === ids.coach), 'Suspended coach remained publicly visible', visibleAfter);

  const bookingAfter = await request('/api/bookings', clientToken, {
    method: 'POST',
    body: JSON.stringify({ coach_id: ids.coach, client_id: ids.client, booking_date: '2026-09-16T18:00:00.000Z', duration: 60, cancellation_policy_accepted: true, policy_version: '2026-08-14' })
  });
  assert(bookingAfter.status === 400 && bookingAfter.body?.error === 'Coach is unavailable', 'Suspended coach accepted a booking', bookingAfter);

  const hiddenDirectProfile = await request(`/api/users/${ids.coach}`, null);
  assert(hiddenDirectProfile.status === 404, 'Suspended coach direct profile remained public', hiddenDirectProfile);

  const revokedSession = await request(`/api/bookings?coach_id=${ids.coach}`, coachToken);
  assert(revokedSession.status === 401, 'Suspended coach session remained active', revokedSession);

  const suspendedProfile = await executeQueryOne('SELECT is_active, token_revoked_at FROM profiles WHERE id = $1', [ids.coach]);
  assert(suspendedProfile?.is_active === false && suspendedProfile?.token_revoked_at, 'Database suspension flags were not applied', suspendedProfile);

  console.log(JSON.stringify({
    passed: true,
    checks: [
      'verified coach visible before suspension',
      'booking succeeds before suspension',
      'invalid report rejected',
      'urgent report creates critical admin case',
      'administrator can see the case',
      'administrator suspension succeeds',
      'suspended coach hidden from discovery',
      'suspended coach direct profile hidden',
      'suspended coach cannot be booked',
      'suspended coach session rejected'
    ]
  }, null, 2));
} finally {
  await cleanup();
  const remaining = await executeQueryOne(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE id = ANY($1::uuid[])) AS users,
       (SELECT COUNT(*)::int FROM profiles WHERE id = ANY($1::uuid[])) AS profiles,
       (SELECT COUNT(*)::int FROM admin_cases WHERE created_by = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])) AS cases,
       (SELECT COUNT(*)::int FROM bookings WHERE client_id = $2 OR coach_id = $3) AS bookings`,
    [[ids.admin, ids.client, ids.coach], ids.client, ids.coach]
  );
  console.log(JSON.stringify({ cleanup: remaining }, null, 2));
}
