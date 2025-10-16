/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
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

    switch (httpMethod) {
      case 'GET':
        if (userId && userId !== 'users') {
          console.log('📖 Fetching single user:', userId);
          // Get single user by ID
          const user = await executeQueryOne(
            `SELECT * FROM profiles WHERE id = $1`,
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

        // Upsert profile to avoid duplicate key race conditions
        // If a row exists for this email, update selected fields; otherwise insert new
        const upsertedUser = await executeQueryOne(
          `INSERT INTO profiles (id, email, full_name, user_type, role, avatar_url, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE
             SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
                 avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
                 updated_at = NOW()
           RETURNING *`,
          [
            email,
            userData.full_name || '',
            'user',
            'user',
            userData.avatar_url || null
          ]
        );

        console.log('✅ User upserted (created or existing returned):', email);
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
        
        const updatedUser = await executeQueryOne(
          `UPDATE profiles 
           SET full_name = COALESCE($1, full_name),
               phone = COALESCE($2, phone),
               location = COALESCE($3, location),
               bio = COALESCE($4, bio),
               avatar_url = COALESCE($5, avatar_url),
               is_active = COALESCE($6, is_active),
               updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [
            updateData.full_name,
            updateData.phone,
            updateData.location,
            updateData.bio,
            updateData.avatar_url,
            updateData.is_active,
            userId
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

      case 'DELETE':
        // Delete user (soft delete - set deleted flag or actually delete)
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID is required' })
          };
        }

        await executeQuery('DELETE FROM profiles WHERE id = $1', [userId]);

        return {
          statusCode: 204,
          headers,
          body: ''
        };

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
