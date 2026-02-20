/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { getAuthContext, signAuthToken } from './lib/auth.js';
import crypto from 'crypto';
import { Buffer } from 'buffer';

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
export async function handler(event) {
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
    const isAdmin = auth.role === 'admin';
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
                  COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
                  COUNT(*) FILTER (WHERE user_type = 'coach' AND role <> 'admin')::int AS total_coaches,
                  COUNT(*) FILTER (WHERE (user_type = 'client' OR user_type = 'user') AND role <> 'admin')::int AS total_clients,
                  COUNT(*) FILTER (WHERE role <> 'admin')::int AS total_users
                FROM profiles
              `, currentUserId),
              []
            );

            return { statusCode: 200, headers, body: JSON.stringify(stats || {}) };
          }

          const isPublicCoachList = !isAdmin && queryParams.role === 'coach';
          if (!isAdmin && !isPublicCoachList) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
          }

          const publicFields = `id, full_name, avatar_url, user_type, bio, country, city, coach_profile`;
          const selectFields = isPublicCoachList ? publicFields : '*';
          const includeTotal = queryParams.include_total === '1' || queryParams.include_total === 'true';
          let query = `SELECT ${selectFields}${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''} FROM profiles`;
          const conditions = [];
          const params = [];
          const type = queryParams.type || null;
          const search = typeof queryParams.search === 'string' ? queryParams.search.trim() : '';

          if (isPublicCoachList) {
            conditions.push(`user_type = $${params.length + 1}`);
            params.push('coach');
          }

          if (isAdmin) {
            if (type === 'coach') {
              conditions.push(`user_type = $${params.length + 1}`);
              params.push('coach');
              conditions.push(`role <> 'admin'`);
            } else if (type === 'client') {
              conditions.push(`(user_type = 'client' OR user_type = 'user')`);
              conditions.push(`role <> 'admin'`);
            } else if (type === 'admin') {
              conditions.push(`role = 'admin'`);
            }

            if (queryParams.role) {
              conditions.push(`role = $${params.length + 1}`);
              params.push(queryParams.role);
            }

            if (queryParams.ids) {
              const ids = queryParams.ids.split(',').map((id) => id.trim()).filter(Boolean);
              if (ids.length > 0) {
                conditions.push(`id = ANY($${params.length + 1}::uuid[])`);
                params.push(ids);
              }
            }
          }

          if (search) {
            if (isPublicCoachList) {
              conditions.push(`(full_name ILIKE $${params.length + 1} OR bio ILIKE $${params.length + 1})`);
              params.push(`%${search}%`);
            } else if (isAdmin) {
              conditions.push(`(full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
              params.push(`%${search}%`);
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

          if (isPublicCoachList && queryParams.location) {
            conditions.push(`location ILIKE $${params.length + 1}`);
            params.push(`%${queryParams.location}%`);
          }

          if (isPublicCoachList && queryParams.service_type) {
            conditions.push(`(coach_profile->'services_offered') ? $${params.length + 1}`);
            params.push(queryParams.service_type);
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

          const limitDefault = isPublicCoachList ? 40 : 20;
          const limit = Math.min(Number(queryParams.limit) || limitDefault, 100);
          const offset = Math.max(Number(queryParams.offset) || 0, 0);
          query += ` LIMIT ${limit} OFFSET ${offset}`;

          // Set RLS context if user is authenticated
          const finalQuery = currentUserId ? withUserCtx(query, currentUserId) : query;
          const users = await executeQuery(finalQuery, params);

          if (includeTotal) {
            const total = users.length > 0 ? Number(users[0].total_count) : 0;
            const data = users.map(({ total_count, ...rest }) => rest);
            return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit, offset }) };
          }

          return { statusCode: 200, headers, body: JSON.stringify(users) };
        }

  case 'POST': {
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
        console.log('🔐 Login attempt for:', email);

        // Generate a new user id for first-time signup and set it as session context
        const newUserId = crypto.randomUUID();
        const normalizedFullName = (userData.full_name || '').trim() || null;

        // Try a safe EXISTS check; if RLS blocks, treat as unknown and fall back to insert
        let existing = null;
        try {
          existing = await executeQueryOne(`SELECT id FROM profiles WHERE email = $1 LIMIT 1`, [email]);
        } catch {
          console.warn('⚠️ Email lookup blocked by RLS, proceeding with insert-only flow');
        }

        const identity = await executeQueryOne(
          `INSERT INTO users (id, email, full_name, role, phone, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE
           SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
               updated_at = NOW()
           RETURNING id, email, full_name, role`,
          [newUserId, email, normalizedFullName, 'user', userData.phone || null]
        );

        if (existing && identity && existing.id !== identity.id) {
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
              INSERT INTO profiles (id, email, full_name, user_type, role, avatar_url, is_active, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
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
              'user',
              'user',
              userData.avatar_url || null
            ]
          );

          if (!upsertedUser) {
            // Another session created the user; ask client to fetch by id if known
            return {
              statusCode: 409,
              headers,
              body: JSON.stringify({ error: 'User already exists', email })
            };
          }
        } else {
          // Existing user: update a couple of fields with proper context
          const existingId = existing.id;
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

        const token = signAuthToken({ sub: upsertedUser.id, email: upsertedUser.email, role: upsertedUser.role });
        console.log('✅ User upserted/loaded:', email, 'id:', upsertedUser?.id);
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
        const reason = payload.reason || null;
        const hard = payload.hard === true;

        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }

        if (hard && !isAdmin) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required for hard delete' }) };
        }

        if (!hard && !isAdmin && currentUserId !== userId) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Cannot remove other users' }) };
        }

        if (hard) {
          const target = await executeQueryOne(
            withUserCtx('SELECT id, role FROM profiles WHERE id = $1', currentUserId),
            [userId]
          );

          if (!target) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
          }

          if (target.role === 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Cannot hard delete admin users' }) };
          }

          // Hard delete requested. Clean related records first.
          await executeQuery(withUserCtx('DELETE FROM bookings WHERE user_id = $1 OR client_id = $1 OR coach_id = $1', currentUserId), [userId]);
          await executeQuery(withUserCtx('DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1', currentUserId), [userId]);
          await executeQuery(withUserCtx('DELETE FROM reviews WHERE reviewer_id = $1 OR reviewee_id = $1', currentUserId), [userId]);
          await executeQuery(withUserCtx('DELETE FROM coach_availability WHERE coach_id = $1', currentUserId), [userId]);
          await executeQuery(withUserCtx('DELETE FROM coach_recurring_availability WHERE coach_id = $1', currentUserId), [userId]);
          await executeQuery(withUserCtx('DELETE FROM account_deletion_requests WHERE user_id = $1 OR decided_by = $1', currentUserId), [userId]);

          await executeQuery(withUserCtx('DELETE FROM users WHERE id = $1', currentUserId), [userId]);
          await executeQuery(withUserCtx('DELETE FROM profiles WHERE id = $1', currentUserId), [userId]);
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
        message: error.message,
        stack: error.stack
      })
    };
  }
}
