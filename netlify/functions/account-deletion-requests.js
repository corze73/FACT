/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';

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

  try {
    const { httpMethod } = event;

    if (httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const { user_id, reason } = payload;
      if (!user_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id required' }) };

      const req = await executeQueryOne(
        `INSERT INTO account_deletion_requests (user_id, reason)
         VALUES ($1, $2) RETURNING *`,
        [user_id, reason || null]
      );
      return { statusCode: 201, headers, body: JSON.stringify(req) };
    }

    if (httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      let q = `SELECT * FROM account_deletion_requests`;
      const where = [];
      const params = [];
      if (qs.status) { where.push(`status = $${params.length + 1}`); params.push(qs.status); }
      if (qs.user_id) { where.push(`user_id = $${params.length + 1}`); params.push(qs.user_id); }
      if (where.length) q += ' WHERE ' + where.join(' AND ');
      q += ' ORDER BY requested_at DESC';
      const rows = await executeQuery(q, params);
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (httpMethod === 'PUT') {
      const payload = JSON.parse(event.body || '{}');
      const { id, decision, decision_reason, admin_id } = payload;
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
        [decision, admin_id || null, decision_reason || null, id]
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
    console.error('account-deletion-requests error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
