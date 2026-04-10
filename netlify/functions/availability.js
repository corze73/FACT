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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const uuidPattern = /^[0-9a-fA-F-]{36}$/;

const rawHandler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const rateLimitResponse = rateLimitMiddleware(event, headers, getLimitByMethod(event.httpMethod));
  if (rateLimitResponse) return rateLimitResponse;

  const withUserCtx = (query, ctxId) => {
    const safe = (ctxId || '').match(uuidPattern) ? ctxId : '';
    const ctxCte = `__ctx AS (SELECT set_config('app.current_user_id', '${safe}', true))`;
    const trimmed = String(query || '').trimStart();
    if (/^WITH\b/i.test(trimmed)) {
      return trimmed.replace(/^WITH\s+/i, `WITH ${ctxCte}, `);
    }
    return `WITH ${ctxCte} ${trimmed}`;
  };

  const parseBody = (raw) => {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return null;
    }
  };

  const parsePath = (path) => {
    const parts = String(path || '').split('/').filter(Boolean);
    const availabilityIndex = parts.lastIndexOf('availability');
    const after = availabilityIndex >= 0 ? parts.slice(availabilityIndex + 1) : [];
    if (after[0] === 'recurring') {
      return { isRecurring: true, recordId: after[1] || null };
    }
    return { isRecurring: false, recordId: after[0] || null };
  };

  try {
    const auth = await getAuthContext(event);
    const currentUserId = auth.userId;
    const isAdmin = auth.isAdmin === true;
    const { isRecurring, recordId } = parsePath(event.path);
    const tableName = isRecurring ? 'coach_recurring_availability' : 'coach_availability';
    const queryParams = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      const coachId = String(queryParams.coach_id || '').trim();
      const params = [];
      const conditions = [];

      if (recordId) {
        conditions.push(`id = $${params.length + 1}`);
        params.push(recordId);
      }
      if (coachId) {
        conditions.push(`coach_id = $${params.length + 1}`);
        params.push(coachId);
      }

      const orderClause = isRecurring
        ? 'ORDER BY day_of_week ASC, start_time ASC'
        : 'ORDER BY start_date ASC';
      const rows = await executeQuery(
        withUserCtx(
          `SELECT * FROM ${tableName}
           ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
           ${orderClause}`,
          currentUserId || ''
        ),
        params
      );

      if (recordId) {
        if (!rows[0]) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Availability record not found' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(rows[0]) };
      }

      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (!currentUserId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    if (event.httpMethod === 'DELETE') {
      if (!recordId || !uuidPattern.test(recordId)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Availability record id is required' }) };
      }

      const deleted = await executeQueryOne(
        withUserCtx(
          `DELETE FROM ${tableName}
           WHERE id = $1
           RETURNING *`,
          currentUserId
        ),
        [recordId]
      );

      if (!deleted) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Availability record not found' }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id: recordId }) };
    }

    const payload = parseBody(event.body);
    if (payload === null) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const coachId = String(payload.coach_id || '').trim();
    if (!coachId || !uuidPattern.test(coachId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'coach_id is required' }) };
    }
    if (!isAdmin && coachId !== currentUserId) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'You can only manage your own availability' }) };
    }

    if (event.httpMethod === 'POST') {
      if (isRecurring) {
        const dayOfWeek = Number(payload.day_of_week);
        const startTime = String(payload.start_time || '').trim();
        const endTime = String(payload.end_time || '').trim();
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime || !endTime) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'day_of_week, start_time, and end_time are required for recurring availability' }) };
        }

        const created = await executeQueryOne(
          withUserCtx(
            `INSERT INTO coach_recurring_availability (
               coach_id, day_of_week, start_time, end_time, is_active, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            currentUserId
          ),
          [coachId, dayOfWeek, startTime, endTime, payload.is_active !== false]
        );

        return { statusCode: 201, headers, body: JSON.stringify(created) };
      }

      const startDate = String(payload.start_date || '').trim();
      const endDate = String(payload.end_date || '').trim();
      if (!startDate || !endDate) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'start_date and end_date are required' }) };
      }

      const created = await executeQueryOne(
        withUserCtx(
          `INSERT INTO coach_availability (
             coach_id, start_date, end_date, is_available, location_override, notes, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING *`,
          currentUserId
        ),
        [
          coachId,
          startDate,
          endDate,
          payload.is_available !== false,
          payload.location_override || null,
          payload.notes || null
        ]
      );

      return { statusCode: 201, headers, body: JSON.stringify(created) };
    }

    if (!recordId || !uuidPattern.test(recordId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Availability record id is required' }) };
    }

    if (event.httpMethod === 'PUT') {
      if (isRecurring) {
        const fields = [];
        const params = [];
        let index = 1;
        const setField = (column, value) => {
          fields.push(`${column} = $${index++}`);
          params.push(value);
        };

        setField('coach_id', coachId);
        if (payload.day_of_week !== undefined) setField('day_of_week', Number(payload.day_of_week));
        if (payload.start_time !== undefined) setField('start_time', payload.start_time);
        if (payload.end_time !== undefined) setField('end_time', payload.end_time);
        if (payload.is_active !== undefined) setField('is_active', Boolean(payload.is_active));
        fields.push('updated_at = NOW()');
        params.push(recordId);

        const updated = await executeQueryOne(
          withUserCtx(
            `UPDATE coach_recurring_availability
             SET ${fields.join(', ')}
             WHERE id = $${index}
             RETURNING *`,
            currentUserId
          ),
          params
        );

        if (!updated) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Availability record not found' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(updated) };
      }

      const fields = [];
      const params = [];
      let index = 1;
      const setField = (column, value) => {
        fields.push(`${column} = $${index++}`);
        params.push(value);
      };

      setField('coach_id', coachId);
      if (payload.start_date !== undefined) setField('start_date', payload.start_date);
      if (payload.end_date !== undefined) setField('end_date', payload.end_date);
      if (payload.is_available !== undefined) setField('is_available', Boolean(payload.is_available));
      if (payload.location_override !== undefined) setField('location_override', payload.location_override || null);
      if (payload.notes !== undefined) setField('notes', payload.notes || null);
      fields.push('updated_at = NOW()');
      params.push(recordId);

      const updated = await executeQueryOne(
        withUserCtx(
          `UPDATE coach_availability
           SET ${fields.join(', ')}
           WHERE id = $${index}
           RETURNING *`,
          currentUserId
        ),
        params
      );

      if (!updated) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Availability record not found' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(updated) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    captureFunctionError(error, {
      functionName: 'availability',
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

export const handler = withFunctionObservability('availability', rawHandler);