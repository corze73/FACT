/* eslint-env node */
import { Buffer } from 'buffer';
import { executeQueryOne } from './lib/db.js';
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
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);
const isAllowedStatus = (v) => ['incomplete', 'pending', 'verified', 'rejected'].includes(v);

const withUserCtx = (query, ctxId) => {
  const safe = isUuid(ctxId) ? ctxId : '';
  return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
};

const cleanText = (value, max = 200) => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
};

const cleanUrl = (value) => {
  const s = cleanText(value, 2000);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
};

const decodeBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  return JSON.parse(raw);
};

const rawHandler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path || '';
  if (!(event.httpMethod === 'PATCH' && /\/profile\/compliance(?:\/)?$/.test(path))) {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const rateLimitResponse = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await getAuthContext(event);
    if (!auth.userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    if (auth.userType !== 'coach') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Coach access required' }) };
    }

    const payload = decodeBody(event);

    const existing = await executeQueryOne(
      withUserCtx(
        `SELECT id, user_type, qualification_file_url, qualification_status,
                has_background_check, background_check_file_url, background_check_status,
                insurance_file_url, insurance_status
         FROM profiles
         WHERE id = $1`,
        auth.userId
      ),
      [auth.userId]
    );

    if (!existing || existing.user_type !== 'coach') {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Coach profile not found' }) };
    }

    const qualificationType = cleanText(payload.qualification_type, 120);
    const qualificationFileUrl = cleanUrl(payload.qualification_file_url);
    const hasBackgroundCheck = Boolean(payload.has_background_check);
    const backgroundCheckType = cleanText(payload.background_check_type, 120);
    const backgroundCheckFileUrl = cleanUrl(payload.background_check_file_url);
    const backgroundCheckExpiresAt = cleanText(payload.background_check_expires_at, 32);
    const insuranceProvider = cleanText(payload.insurance_provider, 160);
    const insurancePolicyNumber = cleanText(payload.insurance_policy_number, 160);
    const insuranceCoverAmount = payload.insurance_cover_amount_gbp === undefined || payload.insurance_cover_amount_gbp === null || payload.insurance_cover_amount_gbp === ''
      ? null : Number(payload.insurance_cover_amount_gbp);
    const insuranceFileUrl = cleanUrl(payload.insurance_file_url);
    const insuranceStartsAt = cleanText(payload.insurance_starts_at, 32);
    const insuranceExpiresAt = cleanText(payload.insurance_expires_at, 32);

    if (hasBackgroundCheck && !backgroundCheckFileUrl && !existing.background_check_file_url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Background check document is required when has_background_check is true' })
      };
    }

    if (backgroundCheckExpiresAt && Number.isNaN(Date.parse(backgroundCheckExpiresAt))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid background_check_expires_at date' }) };
    }
    const hasAnyInsurance = Boolean(insuranceProvider || insurancePolicyNumber || insuranceExpiresAt || insuranceFileUrl || existing.insurance_file_url);
    if (hasAnyInsurance && (!insuranceProvider || !insurancePolicyNumber || !insuranceExpiresAt || (!insuranceFileUrl && !existing.insurance_file_url))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Insurance provider, policy number, expiry date and certificate are required' }) };
    }
    if (insuranceStartsAt && Number.isNaN(Date.parse(insuranceStartsAt))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid insurance_starts_at date' }) };
    }
    if (insuranceExpiresAt && Number.isNaN(Date.parse(insuranceExpiresAt))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid insurance_expires_at date' }) };
    }
    if (insuranceCoverAmount !== null && (!Number.isFinite(insuranceCoverAmount) || insuranceCoverAmount < 0)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid insurance cover amount' }) };
    }

    let qualificationStatus = existing.qualification_status || 'incomplete';
    if (qualificationFileUrl) {
      qualificationStatus = 'pending';
    } else if (!existing.qualification_file_url) {
      qualificationStatus = 'incomplete';
    }

    let backgroundStatus = existing.background_check_status || 'incomplete';
    if (!hasBackgroundCheck) {
      backgroundStatus = 'incomplete';
    } else if (backgroundCheckFileUrl) {
      backgroundStatus = 'pending';
    } else if (!existing.background_check_file_url) {
      backgroundStatus = 'incomplete';
    }

    let insuranceStatus = existing.insurance_status || 'incomplete';
    if (insuranceFileUrl) insuranceStatus = 'pending';
    else if (!existing.insurance_file_url) insuranceStatus = 'incomplete';

    if (!isAllowedStatus(qualificationStatus) || !isAllowedStatus(backgroundStatus) || !isAllowedStatus(insuranceStatus)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid compliance status' }) };
    }

    const updated = await executeQueryOne(
      withUserCtx(
        `UPDATE profiles
         SET qualification_type = COALESCE($1, qualification_type),
             qualification_file_url = COALESCE($2, qualification_file_url),
             qualification_status = $3,
             has_background_check = $4,
             background_check_type = CASE WHEN $4 THEN COALESCE($5, background_check_type) ELSE NULL END,
             background_check_file_url = CASE
               WHEN $4 THEN COALESCE($6, background_check_file_url)
               ELSE NULL
             END,
             background_check_status = $7,
             background_check_expires_at = CASE
               WHEN $4 THEN COALESCE($8::date, background_check_expires_at)
               ELSE NULL
             END,
             insurance_provider = $9,
             insurance_policy_number = $10,
             insurance_cover_amount_gbp = $11,
             insurance_file_url = COALESCE($12, insurance_file_url),
             insurance_status = $13,
             insurance_starts_at = $14::date,
             insurance_expires_at = $15::date,
             coach_profile = jsonb_set(COALESCE(coach_profile, '{}'::jsonb), '{is_verified}', 'false'::jsonb, true),
             updated_at = NOW()
         WHERE id = $16
         RETURNING id, qualification_type, qualification_file_url, qualification_status,
                   has_background_check, background_check_type, background_check_file_url,
                   background_check_status, background_check_expires_at,
                   insurance_provider, insurance_policy_number, insurance_cover_amount_gbp,
                   insurance_file_url, insurance_status, insurance_starts_at, insurance_expires_at,
                   verification_notes, verified_at, verified_by`,
        auth.userId
      ),
      [
        qualificationType,
        qualificationFileUrl,
        qualificationStatus,
        hasBackgroundCheck,
        backgroundCheckType,
        backgroundCheckFileUrl,
        backgroundStatus,
        backgroundCheckExpiresAt,
        insuranceProvider,
        insurancePolicyNumber,
        insuranceCoverAmount,
        insuranceFileUrl,
        insuranceStatus,
        insuranceStartsAt,
        insuranceExpiresAt,
        auth.userId
      ]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: updated })
    };
  } catch (error) {
    captureFunctionError(error, {
      route: 'profile',
      method: event.httpMethod,
      path: event.path
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update compliance' })
    };
  }
};

export const handler = withFunctionObservability('profile', rawHandler);
