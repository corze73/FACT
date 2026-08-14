/* eslint-env node */
import { Buffer } from 'buffer';
import { executeQuery, executeQueryOne } from './lib/db.js';
import { getAuthContext } from './lib/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
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
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);

const withUserCtx = (query, ctxId) => {
  const safe = isUuid(ctxId) ? ctxId : '';
  return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
};

const parseLimit = (raw, fallback = 20, max = 100) => {
  const num = Number(raw ?? fallback);
  if (!Number.isInteger(num) || num < 1 || num > max) return null;
  return num;
};

const parseOffset = (raw, fallback = 0) => {
  const num = Number(raw ?? fallback);
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
};

const allowedStatuses = new Set(['incomplete', 'pending', 'verified', 'rejected']);

const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  return JSON.parse(raw);
};

const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isPastDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dateUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return dateUtc < todayUtc;
};

const isMissingRelationError = (error, relationName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(`relation \"${relationName}\" does not exist`) || message.includes(`relation '${relationName}' does not exist`);
};

const listVerifications = async ({ event, headers, adminId }) => {
  const q = event.queryStringParameters || {};
  const type = q.type || 'coach';
  if (type !== 'coach') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only coach type is supported' }) };
  }

  const status = q.status || 'pending';
  if (!allowedStatuses.has(status)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status filter' }) };
  }

  const limit = parseLimit(q.limit, 20, 100);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  const select = `
    id,
    full_name,
    email,
    city,
    country,
    qualification_type,
    qualification_file_url,
    qualification_status,
    has_background_check,
    background_check_type,
    background_check_file_url,
    background_check_status,
    background_check_expires_at,
    verification_notes,
    verified_at,
    verified_by
  `;

  const query = `
    SELECT ${select}${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
    FROM profiles
    WHERE user_type = 'coach'
      AND (
        qualification_status = $1
        OR (has_background_check = true AND background_check_status = $1)
      )
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = await executeQuery(withUserCtx(query, adminId), [status]);

  if (includeTotal) {
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...rest }) => rest);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data, total, limit, offset })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ data: rows, limit, offset })
  };
};

const updateVerification = async ({ event, headers, adminId, coachId }) => {
  if (!isUuid(coachId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid coach id format' }) };
  }

  const body = parseBody(event);
  const qualificationStatus = body.qualification_status;
  const backgroundStatus = body.background_check_status;
  const notes = typeof body.verification_notes === 'string' ? body.verification_notes.trim().slice(0, 2000) : null;

  const coach = await executeQueryOne(
    withUserCtx(
      `SELECT id, qualification_type, qualification_file_url, has_background_check,
              background_check_type, background_check_file_url, background_check_expires_at
       FROM profiles WHERE id = $1 AND user_type = 'coach'`,
      adminId
    ),
    [coachId]
  );
  if (!coach) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Coach not found' }) };

  if (
    qualificationStatus !== undefined &&
    !allowedStatuses.has(qualificationStatus)
  ) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid qualification_status' }) };
  }

  if (
    backgroundStatus !== undefined &&
    !allowedStatuses.has(backgroundStatus)
  ) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid background_check_status' }) };
  }

  if (qualificationStatus === undefined && backgroundStatus === undefined && notes === null) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'At least one field must be provided' })
    };
  }

  if (qualificationStatus === 'verified' && (!coach.qualification_type || !coach.qualification_file_url)) {
    return { statusCode: 409, headers, body: JSON.stringify({ error: 'A qualification type and document are required before approval' }) };
  }

  if (backgroundStatus === 'verified') {
    if (!coach.has_background_check || !coach.background_check_type || !coach.background_check_file_url) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'A background-check type and document are required before approval' }) };
    }
    if (!coach.background_check_expires_at || isPastDate(coach.background_check_expires_at)) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'A current background-check expiry date is required before approval' }) };
    }
  }

  const stampVerification = [qualificationStatus, backgroundStatus].some(
    (value) => value === 'verified' || value === 'rejected'
  );

  const updated = await executeQueryOne(
    withUserCtx(
      `UPDATE profiles
       SET qualification_status = COALESCE($1, qualification_status),
           background_check_status = COALESCE($2, background_check_status),
           verification_notes = COALESCE($3, verification_notes),
           coach_profile = jsonb_set(
             COALESCE(coach_profile, '{}'::jsonb),
             '{is_verified}',
             to_jsonb(
               COALESCE($1, qualification_status) = 'verified'
               AND COALESCE($2, background_check_status) = 'verified'
               AND background_check_expires_at IS NOT NULL
               AND background_check_expires_at >= CURRENT_DATE
             ),
             true
           ),
           verified_at = CASE WHEN $4 THEN NOW() ELSE verified_at END,
           verified_by = CASE WHEN $4 THEN $5::uuid ELSE verified_by END,
           updated_at = NOW()
       WHERE id = $6
         AND user_type = 'coach'
       RETURNING id, full_name, qualification_status, background_check_status,
                 verification_notes, verified_at, verified_by,
                 qualification_file_url, background_check_file_url,
                 background_check_type, background_check_expires_at`,
      adminId
    ),
    [qualificationStatus ?? null, backgroundStatus ?? null, notes, stampVerification, adminId, coachId]
  );

  if (!updated) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Coach not found' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ data: updated })
  };
};

const listAuditLogs = async ({ event, headers, adminId }) => {
  const q = event.queryStringParameters || {};
  const limit = parseLimit(q.limit, 20, 100);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  const action = typeof q.action === 'string' ? q.action.trim() : '';
  const actorId = typeof q.actor_user_id === 'string' ? q.actor_user_id.trim() : '';
  const targetId = typeof q.target_user_id === 'string' ? q.target_user_id.trim() : '';
  const createdFrom = typeof q.created_from === 'string' ? q.created_from.trim() : '';
  const createdTo = typeof q.created_to === 'string' ? q.created_to.trim() : '';

  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  if (actorId && !isUuid(actorId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid actor_user_id format' }) };
  }

  if (targetId && !isUuid(targetId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid target_user_id format' }) };
  }

  if (createdFrom && !isIsoDate(createdFrom)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid created_from format. Use YYYY-MM-DD' }) };
  }

  if (createdTo && !isIsoDate(createdTo)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid created_to format. Use YYYY-MM-DD' }) };
  }

  if (createdFrom && createdTo && createdFrom > createdTo) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'created_from must be <= created_to' }) };
  }

  const params = [];
  const conditions = [];

  if (action) {
    conditions.push(`l.action = $${params.length + 1}`);
    params.push(action);
  }

  if (actorId) {
    conditions.push(`l.actor_user_id = $${params.length + 1}::uuid`);
    params.push(actorId);
  }

  if (targetId) {
    conditions.push(`l.target_user_id = $${params.length + 1}::uuid`);
    params.push(targetId);
  }

  if (createdFrom) {
    conditions.push(`l.created_at >= $${params.length + 1}::date`);
    params.push(createdFrom);
  }

  if (createdTo) {
    conditions.push(`l.created_at < ($${params.length + 1}::date + INTERVAL '1 day')`);
    params.push(createdTo);
  }

  const query = `
    SELECT
      l.id,
      l.action,
      l.actor_user_id,
      l.target_user_id,
      l.metadata,
      l.created_at,
      actor.full_name AS actor_name,
      target.full_name AS target_name
      ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
    FROM admin_action_logs l
    LEFT JOIN profiles actor ON actor.id = l.actor_user_id
    LEFT JOIN profiles target ON target.id = l.target_user_id
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY l.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  try {
    const rows = await executeQuery(withUserCtx(query, adminId), params);

    if (includeTotal) {
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      const data = rows.map(({ total_count, ...rest }) => rest);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data, total, limit, offset })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: rows, limit, offset })
    };
  } catch (error) {
    if (isMissingRelationError(error, 'admin_action_logs')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: [], total: 0, limit, offset })
      };
    }
    throw error;
  }
};

const listDeletedMessages = async ({ event, headers, adminId }) => {
  const q = event.queryStringParameters || {};
  const limit = parseLimit(q.limit, 20, 100);
  const offset = parseOffset(q.offset, 0);
  const includeTotal = q.include_total === '1' || q.include_total === 'true';
  const deletedBy = typeof q.deleted_by_user_id === 'string' ? q.deleted_by_user_id.trim() : '';
  const bookingId = typeof q.booking_id === 'string' ? q.booking_id.trim() : '';
  const scope = typeof q.deletion_scope === 'string' ? q.deletion_scope.trim() : '';

  if (limit === null || offset === null) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination values' }) };
  }

  if (deletedBy && !isUuid(deletedBy)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid deleted_by_user_id format' }) };
  }

  if (bookingId && !isUuid(bookingId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid booking_id format' }) };
  }

  if (scope && !['single', 'conversation_clear'].includes(scope)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid deletion_scope value' }) };
  }

  const params = [];
  const conditions = [];

  if (deletedBy) {
    conditions.push(`dm.deleted_by_user_id = $${params.length + 1}::uuid`);
    params.push(deletedBy);
  }

  if (bookingId) {
    conditions.push(`dm.booking_id = $${params.length + 1}::uuid`);
    params.push(bookingId);
  }

  if (scope) {
    conditions.push(`dm.deletion_scope = $${params.length + 1}`);
    params.push(scope);
  }

  const query = `
    SELECT
      dm.id,
      dm.original_message_id,
      dm.booking_id,
      dm.sender_id,
      dm.receiver_id,
      dm.content,
      dm.created_date,
      dm.deleted_by_user_id,
      dm.deleted_at,
      dm.deletion_scope,
      dm.metadata,
      deleter.full_name AS deleted_by_name,
      sender.full_name AS sender_name,
      receiver.full_name AS receiver_name
      ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
    FROM deleted_messages dm
    LEFT JOIN profiles deleter ON deleter.id = dm.deleted_by_user_id
    LEFT JOIN profiles sender ON sender.id = dm.sender_id
    LEFT JOIN profiles receiver ON receiver.id = dm.receiver_id
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY dm.deleted_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  try {
    const rows = await executeQuery(withUserCtx(query, adminId), params);

    if (includeTotal) {
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      const data = rows.map(({ total_count, ...rest }) => rest);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data, total, limit, offset })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: rows, limit, offset })
    };
  } catch (error) {
    if (isMissingRelationError(error, 'deleted_messages')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: [], total: 0, limit, offset })
      };
    }
    throw error;
  }
};

const rawHandler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const rateLimitResponse = rateLimitMiddleware(
    event,
    headers,
    event.httpMethod === 'GET' ? RATE_LIMITS.read : RATE_LIMITS.mutation
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await getAuthContext(event);
    if (!auth.userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    if (!auth.isAdmin) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const pathParts = (event.path || '').split('/').filter(Boolean);
    const verificationsIdx = pathParts.findIndex((part) => part === 'verifications');
    const auditLogsIdx = pathParts.findIndex((part) => part === 'audit-logs');
    const deletedMessagesIdx = pathParts.findIndex((part) => part === 'deleted-messages');
    const coachId = verificationsIdx >= 0 ? pathParts[verificationsIdx + 1] : null;

    if (event.httpMethod === 'GET' && verificationsIdx >= 0) {
      return await listVerifications({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'GET' && auditLogsIdx >= 0) {
      return await listAuditLogs({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'GET' && deletedMessagesIdx >= 0) {
      return await listDeletedMessages({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'PATCH' && verificationsIdx >= 0 && coachId) {
      return await updateVerification({ event, headers, adminId: auth.userId, coachId });
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    captureFunctionError(error, {
      route: 'admin',
      method: event.httpMethod,
      path: event.path
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Admin request failed' })
    };
  }
};

export const handler = withFunctionObservability('admin', rawHandler);
