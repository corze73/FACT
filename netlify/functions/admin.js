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

  const stampVerification = [qualificationStatus, backgroundStatus].some(
    (value) => value === 'verified' || value === 'rejected'
  );

  const updated = await executeQueryOne(
    withUserCtx(
      `UPDATE profiles
       SET qualification_status = COALESCE($1, qualification_status),
           background_check_status = COALESCE($2, background_check_status),
           verification_notes = COALESCE($3, verification_notes),
           verified_at = CASE WHEN $4 THEN NOW() ELSE verified_at END,
           verified_by = CASE WHEN $4 THEN $5::uuid ELSE verified_by END,
           updated_at = NOW()
       WHERE id = $6
         AND user_type = 'coach'
       RETURNING id, full_name, qualification_status, background_check_status,
                 verification_notes, verified_at, verified_by,
                 qualification_file_url, background_check_file_url`,
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
    const idx = pathParts.findIndex((part) => part === 'verifications');
    const coachId = idx >= 0 ? pathParts[idx + 1] : null;

    if (event.httpMethod === 'GET' && idx >= 0) {
      return await listVerifications({ event, headers, adminId: auth.userId });
    }

    if (event.httpMethod === 'PATCH' && idx >= 0 && coachId) {
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
