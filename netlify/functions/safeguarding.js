/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { getAuthContext } from './lib/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';

const ALLOWED_CATEGORIES = new Set([
  'child_safety',
  'inappropriate_behaviour',
  'harassment',
  'discrimination',
  'physical_safety',
  'other'
]);

const isUuid = (value) => typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value);

const getAllowedOrigin = (origin) => {
  const allowed = [
    'https://findacoachtoday.com',
    'https://www.findacoachtoday.com',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
  if (process.env.NETLIFY_DEV === 'true') return origin || '*';
  return allowed.includes(origin) ? origin : allowed[0];
};

const getHeaders = (event) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(event.headers?.origin),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
  'Content-Type': 'application/json'
});

const rawHandler = async (event) => {
  const headers = getHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const limited = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
  if (limited) return limited;

  try {
    const auth = await getAuthContext(event);
    if (!auth?.userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const targetUserId = body.subject_user_id || null;
    const bookingId = body.booking_id || null;
    const immediateDanger = body.immediate_danger === true;
    const contactPermission = body.contact_permission === true;

    if (!ALLOWED_CATEGORIES.has(category)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Select a valid concern category' }) };
    }
    if (description.length < 20 || description.length > 4000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Description must be between 20 and 4000 characters' }) };
    }
    if (targetUserId && (!isUuid(targetUserId) || targetUserId === auth.userId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid subject user' }) };
    }
    if (bookingId && !isUuid(bookingId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid booking id' }) };
    }

    let booking = null;
    if (bookingId) {
      booking = await executeQueryOne(
        `SELECT id, client_id, coach_id FROM bookings
         WHERE id = $1 AND (client_id = $2 OR coach_id = $2)`,
        [bookingId, auth.userId]
      );
      if (!booking) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'You cannot report against this booking' }) };
      }
      if (targetUserId && ![booking.client_id, booking.coach_id].includes(targetUserId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Subject user is not part of this booking' }) };
      }
    }

    if (targetUserId) {
      const subject = await executeQueryOne(
        `SELECT id FROM profiles WHERE id = $1 AND user_type IN ('coach', 'client', 'member')`,
        [targetUserId]
      );
      if (!subject) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Subject user not found' }) };
      }
    }

    const priority = immediateDanger ? 'critical' : 'high';
    const caseDescription = [
      `Concern type: ${category}`,
      `Immediate danger reported: ${immediateDanger ? 'yes' : 'no'}`,
      `Reporter permits contact: ${contactPermission ? 'yes' : 'no'}`,
      '',
      description
    ].join('\n');

    const created = await executeQueryOne(
      `INSERT INTO admin_cases (
         title, description, status, priority, category,
         target_user_id, booking_id, created_by, created_at, updated_at
       ) VALUES (
         'Safeguarding concern', $1, 'open', $2, 'safeguarding',
         $3, $4, $5, NOW(), NOW()
       )
       RETURNING id, status, priority, created_at`,
      [caseDescription, priority, targetUserId, bookingId, auth.userId]
    );

    await executeQuery(
      `INSERT INTO admin_action_logs (actor_user_id, action, target_user_id, metadata, created_at)
       VALUES ($1, 'safeguarding_report_submitted', $2, $3::jsonb, NOW())`,
      [auth.userId, targetUserId || auth.userId, JSON.stringify({ case_id: created.id, category, immediate_danger: immediateDanger })]
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        data: created,
        message: 'Your concern has been sent to the FACT safeguarding team.',
        emergency_guidance: immediateDanger ? 'If anyone is in immediate danger, call 999 now.' : null
      })
    };
  } catch (error) {
    captureFunctionError(error, { route: 'safeguarding' });
    const statusCode = Number(error?.statusCode || error?.status || 500);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: statusCode === 500 ? 'Unable to submit safeguarding concern' : error.message })
    };
  }
};

export const handler = withFunctionObservability('safeguarding', rawHandler);
