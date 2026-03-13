/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { getAuthContext, signAuthToken } from './lib/auth.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// Password helpers (scrypt, no third-party deps)
// ---------------------------------------------------------------------------
const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.scrypt(password, salt, 64, (err, buf) => {
    if (err) reject(err);
    else resolve(`${salt}:${buf.toString('hex')}`);
  });
});

const verifyPassword = (password, stored) => new Promise((resolve, reject) => {
  const colonIdx = stored.indexOf(':');
  if (colonIdx === -1) { resolve(false); return; }
  const salt = stored.slice(0, colonIdx);
  const hash = stored.slice(colonIdx + 1);
  crypto.scrypt(password, salt, 64, (err, buf) => {
    if (err) reject(err);
    else {
      try {
        resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), buf));
      } catch {
        resolve(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------
const sendPasswordResetEmail = async (event, email, token) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const base = process.env.APP_BASE_URL ||
    (event?.headers?.origin || 'https://findacoachtoday.com');

  if (!host || !user || !pass) {
    console.warn('SMTP not configured; password reset email skipped');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const resetUrl = `${base}/ResetPassword?token=${encodeURIComponent(token)}`;
  const from = process.env.SMTP_USER || 'support@findacoachtoday.com';

  await transporter.sendMail({
    from: `"FACT Support" <${from}>`,
    to: email,
    subject: 'Reset your FACT password',
    html: `
      <p>Hi,</p>
      <p>We received a request to reset your FACT password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p>The FACT Team</p>
    `,
    text: `Reset your FACT password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`
  });

  return { sent: true };
};

// ---------------------------------------------------------------------------
// Admin notification email for signup events
// ---------------------------------------------------------------------------
const sendAdminSignupNotification = async ({ event, email, userType, success, errorDetails = null }) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'support@findacoachtoday.com';

  if (!host || !user || !pass) {
    console.warn('SMTP not configured; admin signup notification skipped');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  const from = process.env.SMTP_USER || 'support@findacoachtoday.com';
  const subject = success
    ? `New ${userType || 'user'} signup: ${email}`
    : `Signup failed for ${email}`;

  const html = success
    ? `
      <p>A new user signed up on FACT.</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>User type:</strong> ${userType || 'client'}</li>
        <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
      </ul>
    `
    : `
      <p>A signup attempt failed on FACT.</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>User type:</strong> ${userType || 'client'}</li>
        <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
      </ul>
      <pre>${errorDetails ? JSON.stringify(errorDetails, null, 2) : 'No details provided'}</pre>
    `;

  await transporter.sendMail({
    from: `"FACT Support" <${from}>`,
    to: adminEmail,
    subject,
    html,
    text: success
      ? `New signup: ${email} (${userType || 'client'})`
      : `Signup failed: ${email} (${userType || 'client'}) - ${JSON.stringify(errorDetails || {})}`
  });

  return { sent: true };
};

// CORS headers for all responses
const getAllowedOrigin = (requestOrigin) => {
  const allowedOrigins = [
    'https://findacoachtoday.com',
    'https://www.findacoachtoday.com',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
  // In development (Netlify CLI), allow localhost
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

// Version: 2024-10-16-001
/**
 * Netlify Function: User Operations
 * Endpoints:
 * - GET /api/users - Get all users
 * - GET /api/users/:id - Get single user
 * - POST /api/users - Create user
 * - PUT /api/users/:id - Update user
 * - DELETE /api/users/:id - Delete user
 */
const rawHandler = async (event) => {
  const headers = getHeaders(event);
  
  console.log('🔍 Users function called:', {
    method: event.httpMethod,
    path: event.path,
    userId: event.path.split('/').filter(Boolean).pop()
  });

  // Handle preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apply rate limiting (stricter for POST/registration, normal for reads)
  const limit = event.httpMethod === 'POST' ? RATE_LIMITS.auth : RATE_LIMITS.default;
  const rateLimitResponse = rateLimitMiddleware(event, headers, limit);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    let { httpMethod, body, path, headers: requestHeaders } = event;
    
    console.log('📊 Processing request:', { httpMethod, path, hasBody: !!body });
    
    const auth = await getAuthContext(event);
    const currentUserId = auth.userId;
    const isAdmin = auth.isAdmin === true;
    const adminScope = auth.adminScope || 'full';
    console.log('👤 Auth user ID:', currentUserId);
    
    // Parse body if it exists and is base64 encoded
    if (body && event.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf-8');
      console.log('🔐 Decoded base64 body');
    }
    
  // Extract user ID from path (e.g., /.netlify/functions/users/123 -> 123)
    const pathParts = path.split('/').filter(Boolean);
    const userId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;
    
  console.log('🎯 Extracted userId:', userId);
    
  // Basic UUID validation (36-char with dashes)
  const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);

    // Helper to prefix a query with a transaction-local user context without shifting placeholders
    const withUserCtx = (query, ctxId) => {
      // Basic UUID allowlist to avoid injection if misused
      const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
      return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
    };

    const logAdminAction = async ({ actorId, action, targetUserId, metadata = {} }) => {
      if (!actorId || !action || !targetUserId) return;
      await executeQuery(
        withUserCtx(
          `INSERT INTO admin_action_logs (actor_user_id, action, target_user_id, metadata, created_at)
           VALUES ($1, $2, $3, $4::jsonb, NOW())`,
          actorId
        ),
        [actorId, action, targetUserId, JSON.stringify(metadata)]
      );
    };

    const tableExists = async (tableName) => {
      const row = await executeQueryOne('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
      return Boolean(row?.table_name);
    };

    const columnExists = async (tableName, columnName) => {
      const row = await executeQueryOne(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = $1
             AND column_name = $2
         ) AS exists`,
        [tableName, columnName]
      );
      return Boolean(row?.exists);
    };

    const logAuthEvent = async ({ eventType, userEmail, success, errorDetails = null, contextUserId = null, signupSource = null }) => {
      try {
        if (!(await tableExists('auth_logs'))) return;

        const userAgent = requestHeaders?.['user-agent'] || requestHeaders?.['User-Agent'] || '';
        const forwardedFor = requestHeaders?.['x-forwarded-for'] || requestHeaders?.['X-Forwarded-For'] || '';
        const ipAddress = String(forwardedFor).split(',')[0]?.trim() || 'unknown';
        const now = new Date().toISOString();

        const hasSignupSourceColumn = await columnExists('auth_logs', 'signup_source');
        if (hasSignupSourceColumn) {
          await executeQuery(
            withUserCtx(
              `INSERT INTO auth_logs (id, event_type, user_email, success, error_details, user_agent, ip_address, signup_source, timestamp, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              contextUserId || currentUserId || ''
            ),
            [
              crypto.randomUUID(),
              eventType,
              userEmail,
              success,
              errorDetails ? JSON.stringify(errorDetails) : null,
              userAgent,
              ipAddress,
              signupSource,
              now,
              now
            ]
          );
        } else {
          await executeQuery(
            withUserCtx(
              `INSERT INTO auth_logs (id, event_type, user_email, success, error_details, user_agent, ip_address, timestamp, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              contextUserId || currentUserId || ''
            ),
            [
              crypto.randomUUID(),
              eventType,
              userEmail,
              success,
              errorDetails ? JSON.stringify(errorDetails) : null,
              userAgent,
              ipAddress,
              now,
              now
            ]
          );
        }
      } catch (logError) {
        console.warn('Auth event logging skipped:', logError?.message || logError);
      }
    };

    switch (httpMethod) {
      case 'GET':
        if (userId && userId !== 'users') {
          if (!currentUserId) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
          }
          if (!isUuid(userId)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid user id format' }) };
          }
          console.log('📖 Fetching single user:', userId);
          // Get single user by ID
          const user = await executeQueryOne(
            withUserCtx(`SELECT * FROM profiles WHERE id = $1`, userId),
            [userId]
          );
          
          console.log('✅ User query result:', user ? 'Found' : 'Not found');

          if (!user) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'User not found' })
            };
          }

          // Return user with coach_profile from JSONB field
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(user)
          };
        } else {
          // Get all users (with query filters if provided)
          const queryParams = event.queryStringParameters || {};
          if (queryParams.stats === '1') {
            if (!isAdmin) {
              return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
            }

            const stats = await executeQueryOne(
              withUserCtx(`
                SELECT
                  COUNT(*)::int AS total_accounts,
                  COUNT(*) FILTER (WHERE user_type = 'admin')::int AS admins,
                  COUNT(*) FILTER (WHERE user_type = 'coach')::int AS total_coaches,
                  COUNT(*) FILTER (WHERE user_type = 'client')::int AS total_clients,
                  COUNT(*) FILTER (WHERE user_type <> 'admin')::int AS total_users
                FROM profiles
              `, currentUserId),
              []
            );

            return { statusCode: 200, headers, body: JSON.stringify(stats || {}) };
          }

          const requestedPublicCoachList =
            queryParams.role === 'coach' || queryParams.type === 'coach' || queryParams.user_type === 'coach';
          const isPublicCoachList = !isAdmin && requestedPublicCoachList;
          if (!isAdmin && !isPublicCoachList) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
          }

          const includeTotal = queryParams.include_total === '1' || queryParams.include_total === 'true';

          if (isPublicCoachList && (queryParams.limit === undefined || queryParams.offset === undefined)) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Public coach list requires limit and offset parameters' })
            };
          }

          const parseLimit = (raw, fallback, max) => {
            const num = Number(raw ?? fallback);
            if (!Number.isInteger(num) || num < 1 || num > max) return null;
            return num;
          };

          const parseOffset = (raw, fallback = 0) => {
            const num = Number(raw ?? fallback);
            if (!Number.isInteger(num) || num < 0) return null;
            return num;
          };

          const limitDefault = isPublicCoachList ? 24 : 20;
          const limitMax = 50;
          const limit = parseLimit(queryParams.limit, limitDefault, limitMax);
          const offset = parseOffset(queryParams.offset, 0);

          if (limit === null || offset === null) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Invalid pagination. limit must be 1-50 and offset must be >= 0' })
            };
          }

          const publicFields = `
            id,
            full_name,
            avatar_url,
            user_type,
            city,
            country,
            qualification_status,
            background_check_status,
            background_check_expires_at,
            has_background_check,
            LEFT(COALESCE(NULLIF(TRIM(bio), ''), coach_profile->>'headline', ''), 280) AS bio,
            COALESCE(coach_profile->'services_offered', '[]'::jsonb) AS services_offered,
            COALESCE((coach_profile->>'hourly_rate')::numeric, 0) AS hourly_rate,
            COALESCE((coach_profile->>'rating')::numeric, 0) AS rating,
            COALESCE((coach_profile->>'total_reviews')::int, 0) AS total_reviews
          `;
          const adminListFields = `
            id,
            full_name,
            email,
            user_type,
            admin_scope,
            is_active,
            deactivated_at,
            deactivation_reason,
            COALESCE(preferred_coaching_types, '{}'::text[]) AS preferred_coaching_types,
            jsonb_build_object(
              'services_offered',
              COALESCE(coach_profile->'services_offered', '[]'::jsonb)
            ) AS coach_profile
          `;
          const isAdminListView = isAdmin && queryParams.view === 'admin_list';
          const selectFields = isPublicCoachList
            ? publicFields
            : isAdminListView
              ? adminListFields
              : '*';
          let query = `SELECT ${selectFields}${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''} FROM profiles`;
          const conditions = [];
          const params = [];
          const type = queryParams.type || null;
          const q = typeof queryParams.q === 'string'
            ? queryParams.q.trim()
            : (typeof queryParams.search === 'string' ? queryParams.search.trim() : '');

          if (isPublicCoachList) {
            conditions.push(`user_type = $${params.length + 1}`);
            params.push('coach');
            conditions.push(`COALESCE(is_active, true) = true`);
            conditions.push(`NULLIF(TRIM(COALESCE(country, '')), '') IS NOT NULL`);
            conditions.push(`NULLIF(TRIM(COALESCE(city, '')), '') IS NOT NULL`);
          }

          if (isAdmin) {
            if (type === 'coach') {
              conditions.push(`user_type = $${params.length + 1}`);
              params.push('coach');
            } else if (type === 'client') {
              conditions.push(`user_type = 'client'`);
            } else if (type === 'admin') {
              conditions.push(`user_type = 'admin'`);
            }

            if (queryParams.role) {
              if (queryParams.role === 'admin') {
                conditions.push(`user_type = 'admin'`);
              } else if (queryParams.role === 'coach') {
                conditions.push(`user_type = 'coach'`);
              } else if (queryParams.role === 'user' || queryParams.role === 'client') {
                conditions.push(`user_type = 'client'`);
              }
            }

            if (queryParams.ids) {
              const ids = queryParams.ids.split(',').map((id) => id.trim()).filter(Boolean);
              if (ids.length > 0) {
                conditions.push(`id = ANY($${params.length + 1}::uuid[])`);
                params.push(ids);
              }
            }
          }

          if (q) {
            if (isPublicCoachList) {
              conditions.push(`(
                full_name ILIKE $${params.length + 1}
                OR bio ILIKE $${params.length + 1}
                OR COALESCE(coach_profile->'services_offered', '[]'::jsonb)::text ILIKE $${params.length + 1}
                OR COALESCE(array_to_string(skills, ' '), '') ILIKE $${params.length + 1}
              )`);
              params.push(`%${q}%`);
            } else if (isAdmin) {
              conditions.push(`(full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
              params.push(`%${q}%`);
            }
          }

          if (isPublicCoachList && queryParams.country) {
            conditions.push(`country ILIKE $${params.length + 1}`);
            params.push(`%${queryParams.country}%`);
          }

          if (isPublicCoachList && queryParams.city) {
            conditions.push(`city ILIKE $${params.length + 1}`);
            params.push(`%${queryParams.city}%`);
          }

          // Legacy fallback only for old clients still sending `location` filter.
          if (isPublicCoachList && queryParams.location) {
            conditions.push(`location ILIKE $${params.length + 1}`);
            params.push(`%${queryParams.location}%`);
          }

          if (isPublicCoachList && queryParams.service_type) {
            conditions.push(`(coach_profile->'services_offered') ? $${params.length + 1}`);
            params.push(queryParams.service_type);
          }

          if (isPublicCoachList && (queryParams.verified_background === '1' || queryParams.verified_background === 'true')) {
            conditions.push(`background_check_status = 'verified'`);
            conditions.push(`(background_check_expires_at IS NULL OR background_check_expires_at >= CURRENT_DATE)`);
          }

          if (isPublicCoachList && queryParams.min_rate) {
            conditions.push(`COALESCE((coach_profile->>'hourly_rate')::numeric, 0) >= $${params.length + 1}`);
            params.push(Number(queryParams.min_rate));
          }

          if (isPublicCoachList && queryParams.max_rate) {
            conditions.push(`COALESCE((coach_profile->>'hourly_rate')::numeric, 0) <= $${params.length + 1}`);
            params.push(Number(queryParams.max_rate));
          }

          if (isPublicCoachList && queryParams.min_rating) {
            conditions.push(`COALESCE((coach_profile->>'rating')::numeric, 0) >= $${params.length + 1}`);
            params.push(Number(queryParams.min_rating));
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY created_at DESC';

          query += ` LIMIT ${limit} OFFSET ${offset}`;

          // Set RLS context if user is authenticated
          const finalQuery = currentUserId ? withUserCtx(query, currentUserId) : query;
          const users = await executeQuery(finalQuery, params);

          if (includeTotal) {
            const total = users.length > 0 ? Number(users[0].total_count) : 0;
            const data = users.map(({ total_count, ...rest }) => rest);
            return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit, offset }) };
          }

          if (isPublicCoachList) {
            return { statusCode: 200, headers, body: JSON.stringify({ data: users, limit, offset }) };
          }

          return { statusCode: 200, headers, body: JSON.stringify(users) };
        }

  case 'POST': {
        // ---------------------------------------------------------------
        // Sub-route: POST /users/change-password
        // ---------------------------------------------------------------
        if (userId === 'change-password') {
          if (!currentUserId) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
          }
          let cpBody;
          try { cpBody = JSON.parse(body || '{}'); } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
          }
          const { currentPassword, newPassword } = cpBody;
          if (!newPassword) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'newPassword is required' }) };
          }
          if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'New password must be at least 8 characters' }) };
          }
          const userRow = await executeQueryOne('SELECT password_hash FROM users WHERE id = $1', [currentUserId]);
          const hasExistingPassword = Boolean(userRow?.password_hash);
          if (hasExistingPassword) {
            if (!currentPassword) {
              return { statusCode: 400, headers, body: JSON.stringify({ error: 'Current password is required' }) };
            }
            const valid = await verifyPassword(currentPassword, userRow.password_hash);
            if (!valid) {
              return { statusCode: 400, headers, body: JSON.stringify({ error: 'Current password is incorrect' }) };
            }
          }
          const newHash = await hashPassword(newPassword);
          await executeQuery(
            'UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = NOW() WHERE id = $2',
            [newHash, currentUserId]
          );
          // Revoke existing tokens so other sessions are invalidated
          await executeQuery(
            withUserCtx('UPDATE profiles SET token_revoked_at = NOW(), updated_at = NOW() WHERE id = $1', currentUserId),
            [currentUserId]
          );
          const profile = await executeQueryOne(withUserCtx('SELECT * FROM profiles WHERE id = $1', currentUserId), [currentUserId]);
          const newToken = signAuthToken({ sub: profile.id, email: profile.email, user_type: profile.user_type });
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, token: newToken, initial_password_set: !hasExistingPassword }) };
        }

        // ---------------------------------------------------------------
        // Sub-route: POST /users/forgot-password
        // ---------------------------------------------------------------
        if (userId === 'forgot-password') {
          let fpBody;
          try { fpBody = JSON.parse(body || '{}'); } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
          }
          const fpEmail = String(fpBody.email || '').trim().toLowerCase();
          if (!fpEmail) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
          }
          // Always return 200 to avoid leaking whether the email exists
          const fpUser = await executeQueryOne('SELECT id, email FROM users WHERE email = $1', [fpEmail]);
          if (fpUser) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
            await executeQuery(
              'UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2, updated_at = NOW() WHERE id = $3',
              [tokenHash, expiresAt, fpUser.id]
            );
            try {
              await sendPasswordResetEmail(event, fpEmail, rawToken);
            } catch (emailErr) {
              console.error('Password reset email error:', emailErr.message);
            }
          }
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'If that email is registered, a reset link has been sent.' }) };
        }

        // ---------------------------------------------------------------
        // Sub-route: POST /users/reset-password
        // ---------------------------------------------------------------
        if (userId === 'reset-password') {
          let rpBody;
          try { rpBody = JSON.parse(body || '{}'); } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
          }
          const { token: rawToken, newPassword: rpNewPassword } = rpBody;
          if (!rawToken || !rpNewPassword) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'token and newPassword are required' }) };
          }
          if (typeof rpNewPassword !== 'string' || rpNewPassword.length < 8) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
          }
          const tokenHash = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
          const rpUser = await executeQueryOne(
            'SELECT id, email FROM users WHERE password_reset_token_hash = $1 AND password_reset_expires_at > NOW()',
            [tokenHash]
          );
          if (!rpUser) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or expired reset link. Please request a new one.' }) };
          }
          const rpHash = await hashPassword(rpNewPassword);
          await executeQuery(
            'UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = NOW() WHERE id = $2',
            [rpHash, rpUser.id]
          );
          // Revoke existing sessions
          await executeQuery(
            withUserCtx('UPDATE profiles SET token_revoked_at = NOW(), updated_at = NOW() WHERE id = $1', rpUser.id),
            [rpUser.id]
          );
          const rpProfile = await executeQueryOne(withUserCtx('SELECT * FROM profiles WHERE id = $1', rpUser.id), [rpUser.id]);
          if (!rpProfile) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'User account not found' }) };
          }
          const rpToken = signAuthToken({ sub: rpProfile.id, email: rpProfile.email, user_type: rpProfile.user_type });
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, token: rpToken, user: rpProfile }) };
        }

        // ---------------------------------------------------------------
        // Normal signup / signin flow
        // ---------------------------------------------------------------
        // Login: Check if user exists, create if not (idempotent)
        if (!body) {
          console.error('❌ No request body provided');
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is required' })
          };
        }

        let userData;
        try {
          userData = JSON.parse(body);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON body:', parseError.message);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid JSON in request body' })
          };
        }
        
        // Validate required fields
        if (!userData.email) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email is required' })
          };
        }

        // Normalize and log email
        const email = String(userData.email).trim().toLowerCase();
        const authMode = userData.auth_mode === 'signin'
          ? 'signin'
          : (userData.auth_mode === 'signup' ? 'signup' : 'oauth');
        const requestedUserType = userData.user_type === 'coach' ? 'coach' : 'client';
        const requestedRole = requestedUserType === 'coach' ? 'coach' : 'user';
        const normalizedFullName = (userData.full_name || '').trim() || null;
        const safeFullName = normalizedFullName || email.split('@')[0] || 'User';

        console.log('🔐 Auth request', { authMode, requestedUserType });

        // Validate password for email-based signup
        if (authMode === 'signup') {
          if (!userData.password) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password is required' }) };
          }
          if (typeof userData.password !== 'string' || userData.password.length < 8) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
          }
        }

        const skills = Array.isArray(userData.skills) ? userData.skills : [];
        const preferredCoachingTypes = Array.isArray(userData.preferred_coaching_types) ? userData.preferred_coaching_types : [];
        const preferredSessionTimes = Array.isArray(userData.preferred_session_times) ? userData.preferred_session_times : [];
        const coachProfile = userData.coach_profile && typeof userData.coach_profile === 'object'
          ? userData.coach_profile
          : null;
        const qualificationFileUrl = userData.qualification_file_url || null;
        const backgroundCheckFileUrl = userData.background_check_file_url || null;
        const qualificationStatus = qualificationFileUrl ? 'pending' : 'incomplete';
        const backgroundCheckStatus = backgroundCheckFileUrl ? 'pending' : 'incomplete';

        // Generate a new user id for first-time signup and set it as session context
        const newUserId = crypto.randomUUID();

        // Try a safe EXISTS check; if RLS blocks, treat as unknown and fall back to insert
        let existing = null;
        try {
          existing = await executeQueryOne(`SELECT id FROM profiles WHERE email = $1 LIMIT 1`, [email]);
        } catch {
          console.warn('⚠️ Email lookup blocked by RLS, proceeding with insert-only flow');
        }

        if (authMode === 'signup' && existing) {
          await logAuthEvent({
            eventType: 'signup',
            userEmail: email,
            success: false,
            errorDetails: { reason: 'User already registered' },
            contextUserId: existing.id,
            signupSource: 'email'
          });
          try {
            await sendAdminSignupNotification({
              event,
              email,
              userType: requestedUserType,
              success: false,
              errorDetails: { reason: 'User already registered' }
            });
          } catch (notifyError) {
            console.warn('Admin signup notification failed:', notifyError?.message || notifyError);
          }
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: 'User already registered' })
          };
        }

        if (authMode === 'signin' && !existing) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid email or password' })
          };
        }

        // Verify password on signin
        if (authMode === 'signin') {
          const signinUserRow = await executeQueryOne(
            'SELECT password_hash FROM users WHERE email = $1',
            [email]
          );
          // Support existing users without passwords (pre-password-system accounts)
          if (signinUserRow?.password_hash) {
            // User has a password set — require it
            if (!userData.password) {
              return { statusCode: 401, headers, body: JSON.stringify({ error: 'Password is required' }) };
            }
            const signinValid = await verifyPassword(userData.password, signinUserRow.password_hash);
            if (!signinValid) {
              return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid email or password' }) };
            }
          }
          // If no password_hash exists, allow backward-compatible signin (legacy user)
          // They will be prompted to set a password on their first visit
        }

        // Pre-hash password for signup before INSERT
        const signupPasswordHash = (authMode === 'signup' && userData.password)
          ? await hashPassword(userData.password)
          : null;

        let identity = null;
        if (authMode !== 'signin') {
          identity = await executeQueryOne(
            `INSERT INTO users (id, email, full_name, role, phone, password_hash, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             ON CONFLICT (email) DO UPDATE
             SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
                 password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
                 updated_at = NOW()
             RETURNING id, email, full_name, role`,
            [newUserId, email, safeFullName, 'user', userData.phone || null, signupPasswordHash]
          );
        }

        if (existing && identity && existing.id !== identity.id) {
          if (authMode === 'signup') {
            await logAuthEvent({
              eventType: 'signup',
              userEmail: email,
              success: false,
              errorDetails: { reason: 'Email already mapped to a different user id' },
              contextUserId: existing.id,
              signupSource: 'email'
            });
            try {
              await sendAdminSignupNotification({
                event,
                email,
                userType: requestedUserType,
                success: false,
                errorDetails: { reason: 'Email already mapped to a different user id' }
              });
            } catch (notifyError) {
              console.warn('Admin signup notification failed:', notifyError?.message || notifyError);
            }
          }
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: 'Email already mapped to a different user id', email })
          };
        }

        const targetId = existing?.id || identity?.id || newUserId;

        let upsertedUser;
        if (!existing) {
          // Insert new user profile with context set to the target id (satisfies RLS insert policy)
          upsertedUser = await executeQueryOne(
            withUserCtx(`
              INSERT INTO profiles (
                id, email, full_name, user_type, role, avatar_url, phone,
                location, country, city, postcode,
                bio, skills, preferred_coaching_types, preferred_session_times,
                coach_profile,
                qualification_type, qualification_file_url, qualification_status,
                has_background_check, background_check_type, background_check_file_url,
                background_check_status, background_check_expires_at,
                is_active, created_at, updated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13::text[], $14::text[], $15::text[],
                $16::jsonb,
                $17, $18, $19,
                $20, $21, $22,
                $23, $24,
                true, NOW(), NOW()
              )
              ON CONFLICT (email) DO UPDATE
              SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
                  avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
                  updated_at = NOW()
              RETURNING *
            `, targetId),
            [
              targetId,
              email,
              userData.full_name || '',
              requestedUserType,
              requestedRole,
              userData.avatar_url || null,
              userData.phone || null,
              userData.location || null,
              userData.country || null,
              userData.city || null,
              userData.postcode || null,
              userData.bio || null,
              skills,
              preferredCoachingTypes,
              preferredSessionTimes,
              JSON.stringify(coachProfile),
              userData.qualification_type || null,
              qualificationFileUrl,
              qualificationStatus,
              Boolean(userData.has_background_check),
              userData.background_check_type || null,
              backgroundCheckFileUrl,
              backgroundCheckStatus,
              userData.background_check_expires_at || null
            ]
          );

          if (!upsertedUser) {
            // Another session created the user; ask client to fetch by id if known
            if (authMode === 'signup') {
              await logAuthEvent({
                eventType: 'signup',
                userEmail: email,
                success: false,
                errorDetails: { reason: 'User already exists' },
                contextUserId: targetId,
                signupSource: 'email'
              });
              try {
                await sendAdminSignupNotification({
                  event,
                  email,
                  userType: requestedUserType,
                  success: false,
                  errorDetails: { reason: 'User already exists' }
                });
              } catch (notifyError) {
                console.warn('Admin signup notification failed:', notifyError?.message || notifyError);
              }
            }
            return {
              statusCode: 409,
              headers,
              body: JSON.stringify({ error: 'User already exists', email })
            };
          }
        } else {
          // Existing user: for sign-in keep profile immutable; for oauth, refresh basic info.
          const existingId = existing.id;
          if (authMode === 'signin') {
            upsertedUser = await executeQueryOne(
              withUserCtx('SELECT * FROM profiles WHERE id = $1', existingId),
              [existingId]
            );
          } else {
            upsertedUser = await executeQueryOne(
              withUserCtx(`
                UPDATE profiles 
                SET full_name = COALESCE($2, full_name),
                    avatar_url = COALESCE($3, avatar_url),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
              `, existingId),
              [existingId, userData.full_name || '', userData.avatar_url || null]
            );
          }
        }

        const token = signAuthToken({ sub: upsertedUser.id, email: upsertedUser.email, user_type: upsertedUser.user_type });
        const shouldLogSignupSuccess = authMode === 'signup' || (authMode === 'oauth' && !existing);
        if (shouldLogSignupSuccess) {
          const signupSource = authMode === 'oauth' ? 'oauth' : 'email';
          await logAuthEvent({
            eventType: 'signup',
            userEmail: email,
            success: true,
            contextUserId: upsertedUser.id,
            signupSource
          });
          try {
            await sendAdminSignupNotification({
              event,
              email,
              userType: requestedUserType,
              success: true
            });
          } catch (notifyError) {
            console.warn('Admin signup notification failed:', notifyError?.message || notifyError);
          }
        }
        console.log('✅ User upserted/loaded', { id: upsertedUser?.id });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ...upsertedUser, token })
        };
      }

  case 'PUT': {
        // Update user
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID is required' })
          };
        }

        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }

        const updateData = JSON.parse(body);

        // Validate video clip URLs (only allow http/https URLs to approved hosts; disallow data URIs)
        const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
        const isDataUri = (v) => typeof v === 'string' && /^data:/i.test(v);
        const allowedHosts = [
          'www.youtube.com', 'youtube.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com'
        ];
        const isAllowedHost = (v) => {
          try {
            const u = new URL(v);
            return allowedHosts.includes(u.hostname);
          } catch { return false; }
        };

        const clip1 = updateData.video_clip_1;
        const clip2 = updateData.video_clip_2;
        const clip3 = updateData.video_clip_3;

        // Reject any data: URIs explicitly
        if ([clip1, clip2, clip3].some(v => v !== undefined && isDataUri(v))) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Video clips must be hosted on YouTube or Vimeo (http/https URLs). Data URIs are not allowed.' })
          };
        }

        // Distinguish three states per field: not provided (leave as-is), provided empty string (clear to NULL), provided valid URL (set)
        const clip1Provided = clip1 !== undefined;
        const clip2Provided = clip2 !== undefined;
        const clip3Provided = clip3 !== undefined;
        const clip1Clear = clip1Provided && clip1 === '';
        const clip2Clear = clip2Provided && clip2 === '';
        const clip3Clear = clip3Provided && clip3 === '';

        // If provided and non-empty, enforce http/https and host allowlist
        const clip1Url = (clip1Provided && !clip1Clear) ? (isHttpUrl(clip1) && isAllowedHost(clip1) ? clip1 : null) : null;
        const clip2Url = (clip2Provided && !clip2Clear) ? (isHttpUrl(clip2) && isAllowedHost(clip2) ? clip2 : null) : null;
        const clip3Url = (clip3Provided && !clip3Clear) ? (isHttpUrl(clip3) && isAllowedHost(clip3) ? clip3 : null) : null;

        if ([clip1, clip2, clip3].some(v => (typeof v === 'string' && v.length > 0) && !isAllowedHost(v))) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Only YouTube and Vimeo URLs are allowed for video clips.' })
          };
        }

        // When restoring (is_active === true), clear deactivation fields
        const updatedUser = await executeQueryOne(
          withUserCtx(`UPDATE profiles 
           SET full_name = COALESCE($1, full_name),
               phone = COALESCE($2, phone),
               location = COALESCE($3, location),
               bio = COALESCE($4, bio),
               avatar_url = COALESCE($5, avatar_url),
               is_active = COALESCE($6, is_active),
               -- Video clip fields: if provided and empty -> NULL (clear); if provided and URL -> set; else keep existing
               video_clip_1 = CASE WHEN $8::boolean THEN (CASE WHEN $9::boolean THEN NULL ELSE $10 END) ELSE video_clip_1 END,
               video_clip_2 = CASE WHEN $11::boolean THEN (CASE WHEN $12::boolean THEN NULL ELSE $13 END) ELSE video_clip_2 END,
               video_clip_3 = CASE WHEN $14::boolean THEN (CASE WHEN $15::boolean THEN NULL ELSE $16 END) ELSE video_clip_3 END,
               deactivated_at = CASE WHEN $6 IS TRUE THEN NULL ELSE deactivated_at END,
               deactivation_reason = CASE WHEN $6 IS TRUE THEN NULL ELSE deactivation_reason END,
               country = COALESCE($17, country),
               city = COALESCE($18, city),
               postcode = COALESCE($19, postcode),
               coach_profile = COALESCE($20::jsonb, coach_profile),
               updated_at = NOW()
           WHERE id = $7
           RETURNING *`, userId),
          [
            updateData.full_name,
            updateData.phone,
            updateData.location,
            updateData.bio,
            updateData.avatar_url,
            updateData.is_active,
            userId,
            // clip 1 controls
            clip1Provided,
            clip1Clear,
            clip1Url,
            // clip 2 controls
            clip2Provided,
            clip2Clear,
            clip2Url,
            // clip 3 controls
            clip3Provided,
            clip3Clear,
            clip3Url,
            // structured location + coach profile
            updateData.country,
            updateData.city,
            updateData.postcode,
            updateData.coach_profile || null
          ]
        );

        if (!updatedUser) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedUser)
        };
    }

  case 'DELETE': {
        // Admin user removal: default to soft-deactivate with reason
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID is required' })
          };
        }

        let payload = {};
  try { payload = body ? JSON.parse(body) : {}; } catch { /* ignore parse error */ }
          const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
        const hard = payload.hard === true;
          const confirmationPhrase = typeof payload.confirmation_phrase === 'string' ? payload.confirmation_phrase.trim() : '';
          const secondAdminId = typeof payload.second_admin_id === 'string' ? payload.second_admin_id.trim() : '';

        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }

        if (!isAdmin) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
        }

        if (adminScope === 'read_only' || adminScope === 'compliance') {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Your admin scope is read-only for user lifecycle actions' }) };
        }

        if (currentUserId === userId) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin self-delete is not allowed' }) };
        }

        if (!reason) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'A reason is required for admin remove actions' }) };
        }

        if (hard) {
          if (adminScope !== 'full') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only full-scope admins can hard delete users' }) };
          }
          const requiredPhrase = `HARD DELETE ${userId}`;
          if (confirmationPhrase !== requiredPhrase) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: `confirmation_phrase must match: ${requiredPhrase}` })
            };
          }

          const hasSecondAdmin = !!secondAdminId;

          if (hasSecondAdmin && !isUuid(secondAdminId)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid second_admin_id is required when provided' }) };
          }

          if (hasSecondAdmin && secondAdminId === currentUserId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'second_admin_id must be different from acting admin' }) };
          }

          if (hasSecondAdmin) {
            const secondAdmin = await executeQueryOne(
              withUserCtx('SELECT id FROM profiles WHERE id = $1 AND user_type = $2', currentUserId),
              [secondAdminId, 'admin']
            );

            if (!secondAdmin) {
              return { statusCode: 400, headers, body: JSON.stringify({ error: 'second_admin_id must reference an existing admin' }) };
            }
          }

          const target = await executeQueryOne(
            withUserCtx('SELECT id, user_type FROM profiles WHERE id = $1', currentUserId),
            [userId]
          );

          if (!target) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
          }

          if (target.user_type === 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Cannot hard delete admin users' }) };
          }

          let snapshotId = null;
          if (await tableExists('deleted_user_snapshots')) {
            const profileSnapshot = await executeQueryOne(withUserCtx('SELECT * FROM profiles WHERE id = $1', currentUserId), [userId]);
            const userSnapshot = await executeQueryOne(withUserCtx('SELECT * FROM users WHERE id = $1', currentUserId), [userId]);
            const bookingCount = await executeQueryOne(withUserCtx('SELECT COUNT(*)::int AS count FROM bookings WHERE user_id = $1 OR client_id = $1 OR coach_id = $1', currentUserId), [userId]);
            const messageCount = await executeQueryOne(withUserCtx('SELECT COUNT(*)::int AS count FROM messages WHERE sender_id = $1 OR receiver_id = $1', currentUserId), [userId]);
            const reviewCount = await executeQueryOne(withUserCtx('SELECT COUNT(*)::int AS count FROM reviews WHERE reviewer_id = $1 OR reviewee_id = $1', currentUserId), [userId]);

            const snapshotPayload = {
              profile: profileSnapshot,
              user: userSnapshot,
              related_counts: {
                bookings: bookingCount?.count || 0,
                messages: messageCount?.count || 0,
                reviews: reviewCount?.count || 0
              },
              captured_at: new Date().toISOString()
            };

            const snapshot = await executeQueryOne(
              withUserCtx(
                `INSERT INTO deleted_user_snapshots (user_id, deleted_by, approved_by, reason, snapshot, created_at)
                 VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
                 RETURNING id`,
                currentUserId
              ),
              [userId, currentUserId, hasSecondAdmin ? secondAdminId : null, reason, JSON.stringify(snapshotPayload)]
            );
            snapshotId = snapshot?.id || null;
          }

          // Hard delete requested. Clean related records first in FK-safe order.
          await executeQuery(withUserCtx(`DELETE FROM messages
            WHERE sender_id = $1
               OR receiver_id = $1
               OR booking_id IN (
                 SELECT id FROM bookings
                 WHERE user_id = $1 OR client_id = $1 OR coach_id = $1
               )`, currentUserId), [userId]);

          await executeQuery(withUserCtx(`DELETE FROM reviews
            WHERE reviewer_id = $1
               OR reviewee_id = $1
               OR booking_id IN (
                 SELECT id FROM bookings
                 WHERE user_id = $1 OR client_id = $1 OR coach_id = $1
               )`, currentUserId), [userId]);

          if (await tableExists('payments')) {
            await executeQuery(withUserCtx(`DELETE FROM payments
              WHERE booking_id IN (
                SELECT id FROM bookings
                WHERE user_id = $1 OR client_id = $1 OR coach_id = $1
              )`, currentUserId), [userId]);
          }

          if (await tableExists('coach_availability')) {
            await executeQuery(withUserCtx('DELETE FROM coach_availability WHERE coach_id = $1', currentUserId), [userId]);
          }
          if (await tableExists('coach_recurring_availability')) {
            await executeQuery(withUserCtx('DELETE FROM coach_recurring_availability WHERE coach_id = $1', currentUserId), [userId]);
          }
          if (await tableExists('account_deletion_requests')) {
            await executeQuery(withUserCtx('DELETE FROM account_deletion_requests WHERE user_id = $1 OR decided_by = $1', currentUserId), [userId]);
          }

          try {
            await executeQuery(withUserCtx('DELETE FROM bookings WHERE user_id = $1 OR client_id = $1 OR coach_id = $1 OR reschedule_requested_by = $1', currentUserId), [userId]);
          } catch (bookingDeleteError) {
            const message = String(bookingDeleteError?.message || '').toLowerCase();
            if (!message.includes('reschedule_requested_by') || !message.includes('does not exist')) {
              throw bookingDeleteError;
            }
            await executeQuery(withUserCtx('DELETE FROM bookings WHERE user_id = $1 OR client_id = $1 OR coach_id = $1', currentUserId), [userId]);
          }

          await executeQuery(withUserCtx('DELETE FROM users WHERE id = $1', currentUserId), [userId]);
          await logAdminAction({
            actorId: currentUserId,
            action: 'user_hard_delete',
            targetUserId: userId,
            metadata: {
              reason,
              second_admin_id: hasSecondAdmin ? secondAdminId : null,
              approval_mode: hasSecondAdmin ? 'dual_admin' : 'single_admin_full_scope',
              snapshot_id: snapshotId
            }
          });
          return { statusCode: 204, headers, body: '' };
        }

        const deactivated = await executeQueryOne(
          withUserCtx(`UPDATE profiles
           SET is_active = false,
               deactivated_at = NOW(),
               deactivation_reason = COALESCE($1, deactivation_reason),
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`, userId),
          [reason, userId]
        );

        if (!deactivated) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
        }

        await logAdminAction({
          actorId: currentUserId,
          action: 'user_deactivated',
          targetUserId: userId,
          metadata: { reason }
        });

        return { statusCode: 200, headers, body: JSON.stringify(deactivated) };
      }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
  } catch (error) {
    captureFunctionError(error, {
      route: 'users',
      method: event.httpMethod,
      path: event.path
    });
    console.error('Error in users function:', {
      error: error.message,
      stack: error.stack,
      path: event.path,
      method: event.httpMethod
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error?.message || 'Request failed'
      })
    };
  }
};

export const handler = withFunctionObservability('users', rawHandler);
