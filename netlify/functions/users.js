import { executeQuery, executeQueryOne } from './lib/db.js';

// CORS headers for all responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

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
  // Handle preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, body, path } = event;
    
    // Extract user ID from path (e.g., /api/users/123 -> 123)
    const pathParts = path.split('/').filter(Boolean);
    const userId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;

    switch (httpMethod) {
      case 'GET':
        if (userId && userId !== 'users') {
          // Get single user by ID
          const user = await executeQueryOne(
            `SELECT u.*, 
                    cp.hourly_rate, cp.bio as coach_bio, cp.certifications, 
                    cp.experience_years, cp.specializations, cp.services_offered, cp.age_groups
             FROM users u
             LEFT JOIN coach_profiles cp ON u.id = cp.user_id
             WHERE u.id = $1`,
            [userId]
          );

          if (!user) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'User not found' })
            };
          }

          // Structure response with nested coach_profile
          const response = {
            ...user,
            coach_profile: user.hourly_rate ? {
              hourly_rate: user.hourly_rate,
              bio: user.coach_bio,
              certifications: user.certifications,
              experience_years: user.experience_years,
              specializations: user.specializations,
              services_offered: user.services_offered,
              age_groups: user.age_groups
            } : null
          };

          // Remove duplicated fields
          delete response.coach_bio;
          delete response.certifications;
          delete response.experience_years;
          delete response.specializations;
          delete response.services_offered;
          delete response.age_groups;
          if (!response.coach_profile) delete response.hourly_rate;

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
          };
        } else {
          // Get all users (with query filters if provided)
          const queryParams = event.queryStringParameters || {};
          let query = `SELECT u.*, 
                              cp.hourly_rate, cp.bio as coach_bio, cp.certifications
                       FROM users u
                       LEFT JOIN coach_profiles cp ON u.id = cp.user_id`;
          const conditions = [];
          const params = [];

          if (queryParams.role) {
            conditions.push(`u.role = $${params.length + 1}`);
            params.push(queryParams.role);
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY u.created_date DESC';

          const users = await executeQuery(query, params);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(users)
          };
        }

      case 'POST': {
        // Create new user
        const userData = JSON.parse(body);
        
        // Validate required fields
        if (!userData.email) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email is required' })
          };
        }

        const newUser = await executeQueryOne(
          `INSERT INTO users (email, full_name, role, phone, location, bio, avatar_url, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            userData.email,
            userData.full_name || '',
            userData.role || 'client',
            userData.phone || null,
            userData.location || null,
            userData.bio || null,
            userData.avatar_url || null,
            userData.is_verified || false
          ]
        );

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newUser)
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
          `UPDATE users 
           SET full_name = COALESCE($1, full_name),
               phone = COALESCE($2, phone),
               location = COALESCE($3, location),
               bio = COALESCE($4, bio),
               avatar_url = COALESCE($5, avatar_url),
               is_verified = COALESCE($6, is_verified),
               updated_date = NOW()
           WHERE id = $7
           RETURNING *`,
          [
            updateData.full_name,
            updateData.phone,
            updateData.location,
            updateData.bio,
            updateData.avatar_url,
            updateData.is_verified,
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

        await executeQuery('DELETE FROM users WHERE id = $1', [userId]);

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
    console.error('Error in users function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
}
