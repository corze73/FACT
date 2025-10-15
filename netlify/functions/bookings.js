import { executeQuery, executeQueryOne } from './lib/db.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Netlify Function: Booking Operations
 * Endpoints:
 * - GET /api/bookings - Get all bookings (with filters)
 * - GET /api/bookings/:id - Get single booking
 * - POST /api/bookings - Create booking
 * - PUT /api/bookings/:id - Update booking
 * - DELETE /api/bookings/:id - Delete booking
 */
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, body, path, queryStringParameters } = event;
    const pathParts = path.split('/').filter(Boolean);
    const bookingId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;

    switch (event.httpMethod) {
      case 'GET': {
        if (bookingId && bookingId !== 'bookings') {
          // Get single booking
          const booking = await executeQueryOne(
            `SELECT b.*,
                    c.full_name as coach_name, c.avatar_url as coach_avatar,
                    cl.full_name as client_name, cl.avatar_url as client_avatar
             FROM bookings b
             LEFT JOIN users c ON b.coach_id = c.id
             LEFT JOIN users cl ON b.client_id = cl.id
             WHERE b.id = $1`,
            [bookingId]
          );

          if (!booking) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Booking not found' })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(booking)
          };
        } else {
          // Get all bookings with filters
          let query = `SELECT b.*,
                              c.full_name as coach_name, c.avatar_url as coach_avatar,
                              cl.full_name as client_name, cl.avatar_url as client_avatar
                       FROM bookings b
                       LEFT JOIN users c ON b.coach_id = c.id
                       LEFT JOIN users cl ON b.client_id = cl.id`;
          
          const conditions = [];
          const params = [];

          // Apply filters from query parameters
          if (queryStringParameters?.coach_id) {
            conditions.push(`b.coach_id = $${params.length + 1}`);
            params.push(queryStringParameters.coach_id);
          }

          if (queryStringParameters?.client_id) {
            conditions.push(`b.client_id = $${params.length + 1}`);
            params.push(queryStringParameters.client_id);
          }

          if (queryStringParameters?.status) {
            conditions.push(`b.status = $${params.length + 1}`);
            params.push(queryStringParameters.status);
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY b.created_date DESC';

          const bookings = await executeQuery(query, params);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(bookings)
          };
        }
      }

      case 'POST': {
        // Create new booking
        const bookingData = JSON.parse(body);

        // Validate required fields
        if (!bookingData.coach_id || !bookingData.client_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'coach_id and client_id are required' })
          };
        }

        if (!bookingData.session_date || !bookingData.session_time) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'session_date and session_time are required' })
          };
        }

        const newBooking = await executeQueryOne(
          `INSERT INTO bookings (
            coach_id, client_id, service_type, session_date, session_time,
            duration, location_type, location_address, client_notes,
            price, admin_fee, total_price, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            bookingData.coach_id,
            bookingData.client_id,
            bookingData.service_type || 'personal_training',
            bookingData.session_date,
            bookingData.session_time,
            bookingData.duration || 60,
            bookingData.location_type || 'online',
            bookingData.location_address || null,
            bookingData.client_notes || null,
            bookingData.price || 0,
            bookingData.admin_fee || 3,
            bookingData.total_price || (bookingData.price + 3),
            bookingData.status || 'pending'
          ]
        );

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newBooking)
        };
      }

      case 'PUT': {
        // Update booking
        if (!bookingId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Booking ID is required' })
          };
        }

        const updateData = JSON.parse(body);

        // Build dynamic update query
        const updateFields = [];
        const updateParams = [];
        let paramCount = 1;

        if (updateData.status !== undefined) {
          updateFields.push(`status = $${paramCount++}`);
          updateParams.push(updateData.status);
        }

        if (updateData.session_date !== undefined) {
          updateFields.push(`session_date = $${paramCount++}`);
          updateParams.push(updateData.session_date);
        }

        if (updateData.session_time !== undefined) {
          updateFields.push(`session_time = $${paramCount++}`);
          updateParams.push(updateData.session_time);
        }

        if (updateData.duration !== undefined) {
          updateFields.push(`duration = $${paramCount++}`);
          updateParams.push(updateData.duration);
        }

        if (updateData.location_type !== undefined) {
          updateFields.push(`location_type = $${paramCount++}`);
          updateParams.push(updateData.location_type);
        }

        if (updateData.location_address !== undefined) {
          updateFields.push(`location_address = $${paramCount++}`);
          updateParams.push(updateData.location_address);
        }

        if (updateData.client_notes !== undefined) {
          updateFields.push(`client_notes = $${paramCount++}`);
          updateParams.push(updateData.client_notes);
        }

        if (updateData.coach_notes !== undefined) {
          updateFields.push(`coach_notes = $${paramCount++}`);
          updateParams.push(updateData.coach_notes);
        }

        if (updateFields.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }

        updateFields.push(`updated_date = NOW()`);
        updateParams.push(bookingId);

        const updatedBooking = await executeQueryOne(
          `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          updateParams
        );

        if (!updatedBooking) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Booking not found' })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedBooking)
        };
      }

      case 'DELETE':
        if (!bookingId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Booking ID is required' })
          };
        }

        await executeQuery('DELETE FROM bookings WHERE id = $1', [bookingId]);

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
    console.error('Error in bookings function:', error);
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
