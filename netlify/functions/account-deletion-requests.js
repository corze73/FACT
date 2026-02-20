/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { getAuthContext } from './lib/auth.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Content-Type': 'application/json'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apply rate limiting (stricter for sensitive account operations)
  const rateLimitResponse = rateLimitMiddleware(event, headers, RATE_LIMITS.auth);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { httpMethod } = event;
    const auth = await getAuthContext(event);
    const currentUserId = auth.userId;
    const isAdmin = auth.isAdmin === true;

    if (httpMethod === 'POST') {
      if (!currentUserId) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
      const payload = JSON.parse(event.body || '{}');
      const { reason } = payload;

      const req = await executeQueryOne(
        `INSERT INTO account_deletion_requests (user_id, reason)
         VALUES ($1, $2) RETURNING *`,
        [currentUserId, reason || null]
      );
      return { statusCode: 201, headers, body: JSON.stringify(req) };
    }

    if (httpMethod === 'GET') {
      if (!currentUserId) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
      const qs = event.queryStringParameters || {};
      let q = `SELECT * FROM account_deletion_requests`;
      const where = [];
      const params = [];
      if (qs.status) { where.push(`status = $${params.length + 1}`); params.push(qs.status); }
      if (!isAdmin) {
        where.push(`user_id = $${params.length + 1}`);
        params.push(currentUserId);
      } else if (qs.user_id) {
        where.push(`user_id = $${params.length + 1}`);
        params.push(qs.user_id);
      }
      if (where.length) q += ' WHERE ' + where.join(' AND ');
      q += ' ORDER BY requested_at DESC';
      const rows = await executeQuery(q, params);
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (httpMethod === 'PUT') {
      if (!currentUserId) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
      if (!isAdmin) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
      const payload = JSON.parse(event.body || '{}');
      const { id, decision, decision_reason } = payload;
      if (!id || !decision || !['approved','rejected'].includes(decision)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and valid decision required' }) };
      }

      const updated = await executeQueryOne(
        `UPDATE account_deletion_requests
         SET status = $1,
             decided_at = NOW(),
             decided_by = $2,
             decision_reason = $3
         WHERE id = $4
         RETURNING *`,
        [decision, currentUserId, decision_reason || null, id]
      );

      if (decision === 'approved' && updated?.user_id) {
        await executeQuery(
          `UPDATE profiles SET is_active = false, deactivated_at = NOW(), deactivation_reason = COALESCE($1, deactivation_reason), updated_at = NOW()
           WHERE id = $2`,
          [decision_reason || 'Account deletion approved', updated.user_id]
        );
      }

      return { statusCode: 200, headers, body: JSON.stringify(updated) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    // Gracefully handle missing table by returning empty list for GET
    const msg = String(e?.message || '');
    if (event?.httpMethod === 'GET' && /relation\s+"?account_deletion_requests"?\s+does not exist/i.test(msg)) {
      console.warn('account_deletion_requests table missing; returning empty list');
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }
    console.error('account-deletion-requests error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
