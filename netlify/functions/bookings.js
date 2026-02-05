/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, getLimitByMethod } from './lib/rateLimiter.js';

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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-id, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

/**
 * Netlify Function: Booking Operations + Admin Archiving
 *
 * Endpoints:
 * - GET    /api/bookings               -> list bookings (filters supported)
 * - GET    /api/bookings/:id           -> single booking
 * - POST   /api/bookings               -> create booking
 * - PUT    /api/bookings/:id           -> update booking
 * - PATCH  /api/bookings/:id/archive   -> archive booking (admin)
 * - PATCH  /api/bookings/:id/restore   -> restore booking (admin)
 * - GET    /api/bookings?stats=1       -> booking stats (admin dashboard tiles)
 * - DELETE /api/bookings/:id           -> hard delete (not recommended)
 *
 * Notes:
 * - By default, list endpoints return ONLY non-archived bookings.
 * - Pass ?archived=1 to return ONLY archived bookings.
 * - Pass ?include_archived=1 to return both.
 */
export async function handler(event) {
  const headers = getHeaders(event);
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apply rate limiting based on HTTP method
  const limit = getLimitByMethod(event.httpMethod);
  const rateLimitResponse = rateLimitMiddleware(event, headers, limit);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { body, path, queryStringParameters, httpMethod, headers: requestHeaders } = event;

    const pathParts = path.split('/').filter(Boolean);
    const last = pathParts[pathParts.length - 1] || null;

    // Netlify will typically call this function at /.netlify/functions/bookings or /api/bookings
    // We treat anything after "bookings" as subpath, e.g. /bookings/:id/archive
    const bookingsIndex = pathParts.lastIndexOf('bookings');
    const afterBookings = bookingsIndex >= 0 ? pathParts.slice(bookingsIndex + 1) : [];
    const bookingId = afterBookings.length >= 1 ? afterBookings[0] : null;
    const action = afterBookings.length >= 2 ? afterBookings[1] : null;

    // Helper: parse truthy query flags
    const isTruthy = (v) => v === '1' || v === 'true' || v === 'yes';

    // Helper: extract user id for RLS context
    const currentUserId = requestHeaders?.['x-user-id'] || requestHeaders?.['x-admin-id'] || requestHeaders?.['X-Admin-Id'];
    console.log('👤 Current user ID from headers:', currentUserId);
    
    // Helper to set RLS context
    const withUserCtx = (query, ctxId) => {
      const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
      return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
    };
    
    const adminIdHeader = requestHeaders?.['x-admin-id'] || requestHeaders?.['X-Admin-Id'];

    switch (httpMethod) {
      case 'GET': {
        // Admin dashboard stats for tiles (Total/Pending/Confirmed/Completed/Cancelled)
        if (isTruthy(queryStringParameters?.stats)) {
          // Note: is_archived column doesn't exist - showing all bookings
          const statsQuery = `
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE b.status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE b.status = 'confirmed')::int AS confirmed,
              COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE b.status = 'cancelled')::int AS cancelled
            FROM bookings b
            `;
          
          const finalStatsQuery = currentUserId ? withUserCtx(statsQuery, currentUserId) : statsQuery;
          const stats = await executeQueryOne(finalStatsQuery);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(stats || { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 })
          };
        }

        // Single booking
        if (bookingId && bookingId !== 'bookings' && bookingId !== 'stats') {
          const booking = await executeQueryOne(
            `SELECT b.*,
                    c.full_name as coach_name, c.avatar_url as coach_avatar,
                    cl.full_name as client_name, cl.avatar_url as client_avatar
             FROM bookings b
             LEFT JOIN profiles c ON b.coach_id = c.id
             LEFT JOIN profiles cl ON b.client_id = cl.id
             WHERE b.id = $1`,
            [bookingId]
          );

          if (!booking) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
          }

          return { statusCode: 200, headers, body: JSON.stringify(booking) };
        }

        // List bookings with filters
        let query = `SELECT b.*,
                            c.full_name as coach_name, c.avatar_url as coach_avatar,
                            cl.full_name as client_name, cl.avatar_url as client_avatar
                     FROM bookings b
                     LEFT JOIN profiles c ON b.coach_id = c.id
                     LEFT JOIN profiles cl ON b.client_id = cl.id`;

        const conditions = [];
        const params = [];

        // Note: is_archived column doesn't exist - removed archive filtering
        // If needed in future, add migration to create is_archived column

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

        // Optional orderBy (e.g., '-created_at' for DESC, 'created_at' for ASC)
        const orderBy = queryStringParameters?.orderBy || '-created_at';
        const orderField = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
        const orderDirection = orderBy.startsWith('-') ? 'DESC' : 'ASC';
        query += ` ORDER BY b.${orderField} ${orderDirection}`;

        // Optional limit for "recent bookings" widget
        if (queryStringParameters?.limit) {
          const limit = Number(queryStringParameters.limit);
          if (Number.isFinite(limit) && limit > 0 && limit <= 1000) {
            query += ` LIMIT ${limit}`;
          }
        }

        const finalQuery = currentUserId ? withUserCtx(query, currentUserId) : query;
        const bookings = await executeQuery(finalQuery, params);

        return { statusCode: 200, headers, body: JSON.stringify(bookings) };
      }

      case 'POST': {
        const bookingData = JSON.parse(body || '{}');

        // Validate required fields (your schema uses booking_date, not session_date/session_time)
        if (!bookingData.coach_id || !bookingData.client_id) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'coach_id and client_id are required' }) };
        }

        if (!bookingData.booking_date) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'booking_date is required (timestamptz)' }) };
        }

        const newBooking = await executeQueryOne(
          `INSERT INTO bookings (
            coach_id, client_id, service_type, booking_date,
            duration, location_type, location_address, location_notes, client_notes,
            price, admin_fee, total_price, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING *`,
          [
            bookingData.coach_id,
            bookingData.client_id,
            bookingData.service_type || 'football_session',
            bookingData.booking_date,
            bookingData.duration || 60,
            bookingData.location_type || 'online',
            bookingData.location_address || null,
            bookingData.location_notes || null,
            bookingData.client_notes || null,
            bookingData.price || 0,
            bookingData.admin_fee ?? 3,
            bookingData.total_price ?? ((bookingData.price || 0) + 3),
            bookingData.status || 'pending'
          ]
        );

        return { statusCode: 201, headers, body: JSON.stringify(newBooking) };
      }

      case 'PUT': {
        if (!bookingId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking ID is required' }) };
        }

        const updateData = JSON.parse(body || '{}');

        const updateFields = [];
        const updateParams = [];
        let paramCount = 1;

        const setField = (col, val) => {
          updateFields.push(`${col} = $${paramCount++}`);
          updateParams.push(val);
        };

        if (updateData.status !== undefined) setField('status', updateData.status);
        if (updateData.booking_date !== undefined) setField('booking_date', updateData.booking_date);
        if (updateData.duration !== undefined) setField('duration', updateData.duration);
        if (updateData.location_type !== undefined) setField('location_type', updateData.location_type);
        if (updateData.location_address !== undefined) setField('location_address', updateData.location_address);
        if (updateData.location_notes !== undefined) setField('location_notes', updateData.location_notes);
        if (updateData.client_notes !== undefined) setField('client_notes', updateData.client_notes);
        if (updateData.notes !== undefined) setField('notes', updateData.notes);
        if (updateData.service_type !== undefined) setField('service_type', updateData.service_type);

        if (updateFields.length === 0) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
        }

        updateFields.push(`updated_at = NOW()`);
        updateParams.push(bookingId);

        const updatedBooking = await executeQueryOne(
          `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          updateParams
        );

        if (!updatedBooking) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify(updatedBooking) };
      }

      case 'PATCH': {
        // PATCH /bookings/:id/archive OR /bookings/:id/restore
        if (!bookingId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking ID is required' }) };
        }

        if (action !== 'archive' && action !== 'restore') {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid PATCH action. Use /archive or /restore.' }) };
        }

        // Basic admin check (we can harden this later using JWT validation)
        if (!adminIdHeader) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing x-admin-id header' }) };
        }

        const adminProfile = await executeQueryOne(
          `SELECT id, role FROM profiles WHERE id = $1 LIMIT 1`,
          [adminIdHeader]
        );

        if (!adminProfile || adminProfile.role !== 'admin') {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
        }

        if (action === 'archive') {
          const updated = await executeQueryOne(
            `UPDATE bookings
             SET is_archived = true,
                 archived_at = NOW(),
                 archived_by = $2,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [bookingId, adminIdHeader]
          );

          if (!updated) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
          }

          return { statusCode: 200, headers, body: JSON.stringify(updated) };
        }

        // restore
        const restored = await executeQueryOne(
          `UPDATE bookings
           SET is_archived = false,
               archived_at = NULL,
               archived_by = NULL,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [bookingId]
        );

        if (!restored) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify(restored) };
      }

      case 'DELETE': {
        // Hard delete (not recommended)
        if (!bookingId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking ID is required' }) };
        }

        await executeQuery('DELETE FROM bookings WHERE id = $1', [bookingId]);

        return { statusCode: 204, headers, body: '' };
      }

      default:
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
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