/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, getLimitByMethod } from './lib/rateLimiter.js';
import { getAuthContext } from './lib/auth.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';

const getAllowedOrigin = (requestOrigin) => {
  const allowedOrigins = [
    'https://findacoachtoday.com',
    'https://www.findacoachtoday.com',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
  if (process.env.NETLIFY_DEV === 'true') return requestOrigin || '*';
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
};

const getHeaders = (event) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(event.headers?.origin),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const rawHandler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const rateLimitResponse = rateLimitMiddleware(event, headers, getLimitByMethod(event.httpMethod));
  if (rateLimitResponse) return rateLimitResponse;

  const withUserCtx = (query, ctxId) => {
    const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
    const ctxCte = `__ctx AS (SELECT set_config('app.current_user_id', '${safe}', true))`;
    const trimmed = String(query || '').trimStart();
    if (/^WITH\b/i.test(trimmed)) {
      return trimmed.replace(/^WITH\s+/i, `WITH ${ctxCte}, `);
    }
    return `WITH ${ctxCte} ${trimmed}`;
  };

  try {
    const auth = await getAuthContext(event);
    const currentUserId = auth.userId;
    const isAdmin = auth.isAdmin === true;
    const { httpMethod } = event;

    if (httpMethod === 'GET') {
      const queryParams = event.queryStringParameters || {};
      const params = [];
      const conditions = [];

      if (queryParams.booking_id) {
        conditions.push(`r.booking_id = $${params.length + 1}`);
        params.push(queryParams.booking_id);
      }
      if (queryParams.reviewer_id) {
        conditions.push(`r.reviewer_id = $${params.length + 1}`);
        params.push(queryParams.reviewer_id);
      }
      if (queryParams.reviewee_id) {
        conditions.push(`r.reviewee_id = $${params.length + 1}`);
        params.push(queryParams.reviewee_id);
      }

      const orderByRaw = typeof queryParams.orderBy === 'string' ? queryParams.orderBy : '-created_at';
      const orderDirection = orderByRaw.startsWith('-') ? 'DESC' : 'ASC';
      const orderField = orderByRaw.startsWith('-') ? orderByRaw.slice(1) : orderByRaw;
      const safeOrderField = new Set(['created_at', 'updated_at', 'rating']).has(orderField) ? orderField : 'created_at';

      const rows = await executeQuery(
        withUserCtx(
          `SELECT r.*, reviewer.full_name AS reviewer_name, reviewer.avatar_url AS reviewer_avatar,
                  reviewee.full_name AS reviewee_name, reviewee.avatar_url AS reviewee_avatar
           FROM reviews r
           LEFT JOIN profiles reviewer ON reviewer.id = r.reviewer_id
           LEFT JOIN profiles reviewee ON reviewee.id = r.reviewee_id
           ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
           ORDER BY r.${safeOrderField} ${orderDirection}`,
          currentUserId || ''
        ),
        params
      );

      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (httpMethod === 'POST') {
      if (!currentUserId) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
      }

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }

      const rating = Number(body.rating);
      const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
      const bookingId = String(body.booking_id || '').trim();
      const reviewerId = String(body.reviewer_id || '').trim();
      const revieweeId = String(body.reviewee_id || '').trim();
      const reviewerType = String(body.reviewer_type || '').trim().toLowerCase();

      if (!bookingId || !reviewerId || !revieweeId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'booking_id, reviewer_id, and reviewee_id are required' }) };
      }
      if (reviewerId !== currentUserId && !isAdmin) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'You can only create reviews as yourself' }) };
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'rating must be an integer from 1 to 5' }) };
      }
      if (reviewerType !== 'client' && reviewerType !== 'coach') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'reviewer_type must be client or coach' }) };
      }

      const booking = await executeQueryOne(
        withUserCtx(
          `SELECT id, client_id, coach_id, status
           FROM bookings
           WHERE id = $1`,
          currentUserId
        ),
        [bookingId]
      );

      if (!booking) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
      }
      if (!isAdmin && booking.status !== 'completed') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Reviews can only be submitted for completed bookings' }) };
      }

      const expectedReviewerId = reviewerType === 'client' ? booking.client_id : booking.coach_id;
      const expectedRevieweeId = reviewerType === 'client' ? booking.coach_id : booking.client_id;
      if (!isAdmin && (expectedReviewerId !== reviewerId || expectedRevieweeId !== revieweeId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Review participants do not match the booking' }) };
      }

      const existing = await executeQueryOne(
        withUserCtx(
          `SELECT id
           FROM reviews
           WHERE booking_id = $1 AND reviewer_id = $2 AND reviewee_id = $3`,
          currentUserId
        ),
        [bookingId, reviewerId, revieweeId]
      );

      if (existing) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Review already exists for this session and reviewer/reviewee.' }) };
      }

      const created = await executeQueryOne(
        withUserCtx(
          `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, reviewer_type, rating, comment, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING *`,
          currentUserId
        ),
        [bookingId, reviewerId, revieweeId, reviewerType, rating, comment || null]
      );

      const aggregate = await executeQueryOne(
        withUserCtx(
          `SELECT ROUND(AVG(rating)::numeric, 1) AS average_rating, COUNT(*)::int AS total_reviews
           FROM reviews
           WHERE reviewee_id = $1`,
          currentUserId
        ),
        [revieweeId]
      );

      await executeQuery(
        withUserCtx(
          `UPDATE profiles
           SET coach_profile = jsonb_set(
                 jsonb_set(COALESCE(coach_profile, '{}'::jsonb), '{rating}', to_jsonb(COALESCE($2::numeric, 0)), true),
                 '{total_reviews}', to_jsonb(COALESCE($3::int, 0)),
                 true
               ),
               updated_at = NOW()
           WHERE id = $1`,
          currentUserId
        ),
        [revieweeId, Number(aggregate?.average_rating || 0), Number(aggregate?.total_reviews || 0)]
      );

      return { statusCode: 201, headers, body: JSON.stringify(created) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    captureFunctionError(error, {
      functionName: 'reviews',
      method: event.httpMethod,
      path: event.path
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Unexpected server error' })
    };
  }
};

export const handler = withFunctionObservability('reviews', rawHandler);