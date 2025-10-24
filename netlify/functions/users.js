/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import crypto from 'crypto';
import { Buffer } from 'buffer';

// CORS headers for all responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

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
  console.log('🔍 Users function called:', {
    method: event.httpMethod,
    path: event.path,
    userId: event.path.split('/').filter(Boolean).pop()
  });

  // Handle preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let { httpMethod, body, path } = event;
    
    console.log('📊 Processing request:', { httpMethod, path, hasBody: !!body });
    
    // Parse body if it exists and is base64 encoded
    if (body && event.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf-8');
      console.log('🔐 Decoded base64 body');
    }
    
    // Extract user ID from path (e.g., /api/users/123 -> 123)
    const pathParts = path.split('/').filter(Boolean);
    const userId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;
    
    console.log('🎯 Extracted userId:', userId);

    // Helper to prefix a query with a transaction-local user context without shifting placeholders
    const withUserCtx = (query, ctxId) => {
      // Basic UUID allowlist to avoid injection if misused
      const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
      return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
    };

    switch (httpMethod) {
      case 'GET':
        if (userId && userId !== 'users') {
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
          let query = `SELECT * FROM profiles`;
          const conditions = [];
          const params = [];

          if (queryParams.role) {
            conditions.push(`role = $${params.length + 1}`);
            params.push(queryParams.role);
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY created_at DESC';

          const users = await executeQuery(query, params);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(users)
          };
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

        // Generate a deterministic new user id for first-time signup and set it as session context
        // This satisfies RLS: id must equal current_setting('app.current_user_id') for INSERT/SELECT
        const newUserId = crypto.randomUUID();

        // Upsert profile to avoid duplicate key race conditions
        // If a row exists for this email, update selected fields; otherwise insert new
        let upsertedUser = await executeQueryOne(
          withUserCtx(`
            INSERT INTO profiles (id, email, full_name, user_type, role, avatar_url, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE
              SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
                  avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
                  updated_at = NOW()
            RETURNING *
          `, newUserId),
          [
            newUserId,              // $1 id
            email,                  // $2 email
            userData.full_name || '', // $3 full_name
            'user',                 // $4 user_type
            'user',                 // $5 role
            userData.avatar_url || null // $6 avatar_url
          ]
        );

        // Safety net: if the UPSERT didn't return a row (some drivers may)
        if (!upsertedUser || !upsertedUser.id) {
          console.warn('⚠️ Upsert returned no id; selecting by email fallback');
          upsertedUser = await executeQueryOne(
            withUserCtx(`SELECT * FROM profiles WHERE email = $1 LIMIT 1`, newUserId),
            [email]
          );
        }

        console.log('✅ User upserted/loaded:', email, 'id:', upsertedUser?.id);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(upsertedUser)
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
            clip3Url
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

        if (hard) {
          // Hard delete requested (use sparingly)
          await executeQuery(withUserCtx('DELETE FROM profiles WHERE id = $1', userId), [userId]);
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
