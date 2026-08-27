/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { getAuthContext } from './lib/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

const withUserCtx = (query, userId) =>
  `WITH __ctx AS (SELECT set_config('app.current_user_id', '${userId}', true)) ${query}`;

const yearsOld = (dateValue) => {
  const dob = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

const clean = (value, max) => String(value || '').trim().slice(0, max);
const participantIdFromPath = (path = '') => path.match(/\/participants\/([0-9a-f-]{36})\/?$/i)?.[1] || null;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const limited = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
  if (limited && event.httpMethod !== 'GET') return limited;

  try {
    const auth = await getAuthContext(event);
    if (!auth.userId) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    if (auth.userType === 'coach') return { statusCode: 403, headers, body: JSON.stringify({ error: 'Coach accounts cannot manage child participants' }) };

    const participantId = participantIdFromPath(event.path);
    if (event.httpMethod === 'GET') {
      const rows = await executeQuery(
        withUserCtx(`SELECT id, full_name, date_of_birth, relationship_to_guardian,
          emergency_contact_name, emergency_contact_phone, medical_or_access_notes,
          guardian_consent_at, is_active, created_at, updated_at
          FROM minor_participants WHERE guardian_id = $1 AND is_active = true
          ORDER BY full_name`, auth.userId),
        [auth.userId]
      );
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    const payload = JSON.parse(event.body || '{}');
    if (event.httpMethod === 'POST') {
      const fullName = clean(payload.full_name, 100);
      const relationship = clean(payload.relationship_to_guardian, 30);
      const age = yearsOld(payload.date_of_birth);
      if (fullName.length < 2 || age === null || age < 0 || age >= 18) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Enter a valid name and date of birth for a participant under 18' }) };
      }
      if (!['parent', 'legal_guardian'].includes(relationship) || payload.guardian_consent !== true) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parent or legal guardian authority and consent are required' }) };
      }
      const created = await executeQueryOne(
        withUserCtx(`INSERT INTO minor_participants (
          guardian_id, full_name, date_of_birth, relationship_to_guardian,
          emergency_contact_name, emergency_contact_phone, medical_or_access_notes,
          guardian_consent_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`, auth.userId),
        [auth.userId, fullName, payload.date_of_birth, relationship,
          clean(payload.emergency_contact_name, 100) || null,
          clean(payload.emergency_contact_phone, 30) || null,
          clean(payload.medical_or_access_notes, 1000) || null]
      );
      return { statusCode: 201, headers, body: JSON.stringify(created) };
    }

    if (!participantId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Participant ID is required' }) };
    if (event.httpMethod === 'DELETE') {
      const archived = await executeQueryOne(
        withUserCtx(`UPDATE minor_participants SET is_active = false, updated_at = NOW()
          WHERE id = $1 AND guardian_id = $2 RETURNING id`, auth.userId),
        [participantId, auth.userId]
      );
      return archived
        ? { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
        : { statusCode: 404, headers, body: JSON.stringify({ error: 'Participant not found' }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    console.error('Participant request failed:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to manage participant' }) };
  }
};
