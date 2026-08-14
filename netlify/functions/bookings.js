/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, getLimitByMethod } from './lib/rateLimiter.js';
import { getAuthContext } from './lib/auth.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';
import { calculateBookingPrice } from './lib/bookingPricing.js';

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
const rawHandler = async (event) => {
  const headers = getHeaders(event);
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apply rate limiting based on HTTP method
  const limit = getLimitByMethod(event.httpMethod);
  const rateLimitResponse = rateLimitMiddleware(event, headers, limit);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { body, path, queryStringParameters, httpMethod } = event;

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

    const auth = await getAuthContext(event);
    const currentUserId = auth.userId;
    const isAdmin = auth.isAdmin === true;
    console.log('👤 Auth user ID:', currentUserId);
    
    // Helper to set RLS context
    const withUserCtx = (query, ctxId) => {
      const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
      return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
    };
    
    switch (httpMethod) {
      case 'GET': {
        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }
        // Admin dashboard stats for tiles (Total/Pending/Confirmed/Completed/Cancelled)
        if (isTruthy(queryStringParameters?.stats)) {
          if (!isAdmin) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
          }
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
          const baseQuery = `SELECT b.*,
                    c.full_name as coach_name, c.avatar_url as coach_avatar,
                    cl.full_name as client_name, cl.avatar_url as client_avatar
             FROM bookings b
             LEFT JOIN profiles c ON b.coach_id = c.id
             LEFT JOIN profiles cl ON b.client_id = cl.id
             WHERE b.id = $1`;
          const finalQuery = withUserCtx(baseQuery, currentUserId);
          const booking = await executeQueryOne(finalQuery, [bookingId]);

          if (!booking) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
          }

          return { statusCode: 200, headers, body: JSON.stringify(booking) };
        }

         // List bookings with filters
         const includeTotal = isTruthy(queryStringParameters?.include_total);

         const parseLimit = (raw) => {
           if (raw === undefined) return null;
           const num = Number(raw);
           if (!Number.isInteger(num) || num < 1 || num > 50) return null;
           return num;
         };

         const parseOffset = (raw) => {
           if (raw === undefined) return null;
           const num = Number(raw);
           if (!Number.isInteger(num) || num < 0) return null;
           return num;
         };

         const parsedLimit = parseLimit(queryStringParameters?.limit);
         const parsedOffset = parseOffset(queryStringParameters?.offset);
         if ((queryStringParameters?.limit !== undefined && parsedLimit === null) || (queryStringParameters?.offset !== undefined && parsedOffset === null)) {
           return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid pagination. limit must be 1-50 and offset must be >= 0' }) };
         }

         const isAdminListView = isAdmin && queryStringParameters?.view === 'admin_list';
         const baseSelect = isAdminListView
           ? `b.id,
              b.coach_id,
              b.client_id,
              b.service_type,
              b.booking_date,
              b.duration,
              b.status,
              b.reschedule_requested_by,
              b.reschedule_proposed_date,
              b.reschedule_status,
              b.reschedule_requested_at,
              b.price,
              b.total_price,
              b.payment_status,
              b.payout_eligible_at,
              b.dispute_status,
              b.cancelled_by,
              b.reference_code,
              b.updated_at,
              b.created_at`
           : 'b.*';

         let query = `SELECT ${baseSelect},
              c.full_name as coach_name, c.avatar_url as coach_avatar,
              cl.full_name as client_name, cl.avatar_url as client_avatar
              ${includeTotal ? ', COUNT(*) OVER() AS total_count' : ''}
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

        // Non-admin users must scope list queries to their own bookings
        if (!isAdmin) {
          const scopedCoachId = queryStringParameters?.coach_id;
          const scopedClientId = queryStringParameters?.client_id;
          const isSelfScoped = scopedCoachId === currentUserId || scopedClientId === currentUserId;
          if (!isSelfScoped) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Access denied for unscoped booking list' }) };
          }
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
        const allowedOrderFields = new Set(['created_at', 'updated_at', 'booking_date', 'status']);
        const safeOrderField = allowedOrderFields.has(orderField) ? orderField : 'created_at';
        query += ` ORDER BY b.${safeOrderField} ${orderDirection}`;

        // Optional pagination
        if (parsedLimit !== null) {
          query += ` LIMIT ${parsedLimit}`;
        }
        if (parsedOffset !== null) {
          query += ` OFFSET ${parsedOffset}`;
        }

        const finalQuery = currentUserId ? withUserCtx(query, currentUserId) : query;
        const bookings = await executeQuery(finalQuery, params);

        if (includeTotal) {
          const total = bookings.length > 0 ? Number(bookings[0].total_count) : 0;
          const data = bookings.map(({ total_count, ...rest }) => rest);
          return { statusCode: 200, headers, body: JSON.stringify({ data, total, limit: parsedLimit, offset: parsedOffset ?? 0 }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify(bookings) };
      }

      case 'POST': {
        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }

        if (bookingId && action) {
          const existing = await executeQueryOne(
            'SELECT * FROM bookings WHERE id = $1',
            [bookingId]
          );
          if (!existing) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
          }
          const isClient = existing.client_id === currentUserId;
          const isCoach = existing.coach_id === currentUserId;
          if (!isClient && !isCoach) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not permitted for this booking' }) };
          }

          if (action === 'arrival') {
            if (!['confirmed', 'in_session'].includes(existing.status)) {
              return { statusCode: 409, headers, body: JSON.stringify({ error: 'Arrival is only available for confirmed sessions' }) };
            }
            const arrivalWindowStart = new Date(existing.booking_date).getTime() - (2 * 60 * 60 * 1000);
            const arrivalWindowEnd = new Date(existing.booking_date).getTime() + ((Number(existing.duration || 60) + 240) * 60 * 1000);
            if (Date.now() < arrivalWindowStart || Date.now() > arrivalWindowEnd) {
              return { statusCode: 409, headers, body: JSON.stringify({ error: 'Arrival can only be recorded near the scheduled session time' }) };
            }
            const column = isCoach ? 'coach_arrived_at' : 'client_arrived_at';
            const otherColumn = isCoach ? 'client_arrived_at' : 'coach_arrived_at';
            const updated = await executeQueryOne(
              `UPDATE bookings SET
                 ${column} = COALESCE(${column}, NOW()),
                 session_started_at = CASE
                   WHEN ${otherColumn} IS NOT NULL
                   THEN COALESCE(session_started_at, NOW()) ELSE session_started_at END,
                 updated_at = NOW()
               WHERE id = $1 RETURNING *`,
              [bookingId]
            );
            return { statusCode: 200, headers, body: JSON.stringify(updated) };
          }

          if (action === 'complete') {
            if (existing.payment_status !== 'captured') {
              return { statusCode: 409, headers, body: JSON.stringify({ error: 'The session cannot complete until payment has been captured' }) };
            }
            if (!existing.session_started_at || existing.status !== 'confirmed') {
              return { statusCode: 409, headers, body: JSON.stringify({ error: 'Both parties must record arrival before completing the session' }) };
            }
            const column = isCoach ? 'coach_completed_at' : 'client_completed_at';
            const otherColumn = isCoach ? 'client_completed_at' : 'coach_completed_at';
            const updated = await executeQueryOne(
              `UPDATE bookings SET
                 ${column} = COALESCE(${column}, NOW()),
                 completed_at = CASE
                   WHEN ${otherColumn} IS NOT NULL
                   THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
                 status = CASE
                   WHEN ${otherColumn} IS NOT NULL
                   THEN 'completed' ELSE status END,
                 payout_eligible_at = CASE
                   WHEN ${otherColumn} IS NOT NULL
                   THEN COALESCE(payout_eligible_at, NOW() + INTERVAL '24 hours') ELSE payout_eligible_at END,
                 updated_at = NOW()
               WHERE id = $1 RETURNING *`,
              [bookingId]
            );
            return { statusCode: 200, headers, body: JSON.stringify(updated) };
          }

          if (action === 'dispute') {
            if (existing.status !== 'completed' || existing.payment_status !== 'captured' ||
                !existing.payout_eligible_at || new Date(existing.payout_eligible_at) <= new Date()) {
              return { statusCode: 409, headers, body: JSON.stringify({ error: 'A dispute can only be opened during the 24-hour completion review window' }) };
            }
            const payload = JSON.parse(body || '{}');
            const reason = String(payload.reason || '').trim();
            if (reason.length < 10) {
              return { statusCode: 400, headers, body: JSON.stringify({ error: 'A dispute reason of at least 10 characters is required' }) };
            }
            const updated = await executeQueryOne(
              `WITH updated_booking AS (
                 UPDATE bookings SET dispute_status = 'open', dispute_reason = $2,
                   dispute_opened_at = NOW(), payout_eligible_at = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *
               ), admin_dispute AS (
                 INSERT INTO booking_disputes (
                   booking_id, opened_by, status, reason, created_at, updated_at
                 )
                 SELECT id, $3, 'open', $2, NOW(), NOW() FROM updated_booking
                 RETURNING id
               )
               SELECT updated_booking.*, admin_dispute.id AS admin_dispute_id
               FROM updated_booking CROSS JOIN admin_dispute`,
              [bookingId, reason, currentUserId]
            );
            return { statusCode: 200, headers, body: JSON.stringify(updated) };
          }

          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Unknown booking action' }) };
        }

        const bookingData = JSON.parse(body || '{}');

        // Validate required fields (your schema uses booking_date, not session_date/session_time)
        if (!bookingData.coach_id || !bookingData.client_id) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'coach_id and client_id are required' }) };
        }

        if (!bookingData.booking_date) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'booking_date is required (timestamptz)' }) };
        }

        if (!isAdmin && bookingData.client_id !== currentUserId) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Bookings can only be created for the authenticated client' }) };
        }

        const duration = Number(bookingData.duration || 60);
        if (!Number.isInteger(duration) || duration < 30 || duration > 240) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'duration must be between 30 and 240 minutes' }) };
        }

        const coach = await executeQueryOne(
          `SELECT id, user_type, is_active, coach_profile, qualification_status,
                  has_background_check, background_check_status, background_check_expires_at,
                  (background_check_expires_at IS NOT NULL AND background_check_expires_at >= CURRENT_DATE) AS background_check_current
           FROM profiles
           WHERE id = $1`,
          [bookingData.coach_id]
        );
        if (!coach || coach.user_type !== 'coach' || coach.is_active === false) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Coach is unavailable' }) };
        }
        const backgroundCheckCurrent = coach.has_background_check === true &&
          coach.background_check_status === 'verified' &&
          coach.background_check_current === true;
        if (coach.qualification_status !== 'verified' || !backgroundCheckCurrent) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: 'This coach is awaiting verification and cannot accept bookings' })
          };
        }

        let pricing;
        try {
          pricing = calculateBookingPrice({
            hourlyRate: coach.coach_profile?.hourly_rate,
            durationMinutes: duration,
          });
        } catch {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Coach does not have valid session pricing' }) };
        }
        const { servicePrice, adminFee, totalPrice } = pricing;

        const insertQuery = `INSERT INTO bookings (
            coach_id, client_id, service_type, booking_date,
            duration, location_type, location_address, location_notes, client_notes,
            price, admin_fee, total_price, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING *`;

        const finalInsertQuery = currentUserId ? withUserCtx(insertQuery, currentUserId) : insertQuery;

        const newBooking = await executeQueryOne(
          finalInsertQuery,
          [
            bookingData.coach_id,
            bookingData.client_id,
            bookingData.service_type || 'football_session',
            bookingData.booking_date,
            duration,
            bookingData.location_type || 'online',
            bookingData.location_address || null,
            bookingData.location_notes || null,
            bookingData.client_notes || null,
            servicePrice,
            adminFee,
            totalPrice,
            'pending'
          ]
        );

        return { statusCode: 201, headers, body: JSON.stringify(newBooking) };
      }

      case 'PUT': {
        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }
        if (!bookingId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking ID is required' }) };
        }

        const updateData = JSON.parse(body || '{}');

        const existingBooking = await executeQueryOne(
          'SELECT id, client_id, coach_id, status FROM bookings WHERE id = $1',
          [bookingId]
        );
        if (!existingBooking) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
        }
        const isClient = existingBooking.client_id === currentUserId;
        const isCoach = existingBooking.coach_id === currentUserId;
        if (!isAdmin && !isClient && !isCoach) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not permitted to update this booking' }) };
        }
        if (!isAdmin) {
          const requestedKeys = Object.keys(updateData);
          const permittedKeys = new Set(['accept', 'cancel', 'cancellation_reason']);
          if (requestedKeys.some((key) => !permittedKeys.has(key))) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'This booking change requires administrator approval' }) };
          }
          if (updateData.accept === true && (!isCoach || existingBooking.status !== 'pending')) {
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'Only the coach can accept a pending booking' }) };
          }
          if (updateData.accept === true) {
            const payoutProfile = await executeQueryOne(
              'SELECT stripe_connect_onboarding_complete, stripe_connect_payouts_enabled FROM profiles WHERE id = $1',
              [currentUserId]
            );
            if (!payoutProfile?.stripe_connect_onboarding_complete || !payoutProfile?.stripe_connect_payouts_enabled) {
              return { statusCode: 409, headers, body: JSON.stringify({ error: 'Complete Stripe payout setup before accepting bookings' }) };
            }
          }
          if (updateData.cancel === true && !['pending', 'confirmed'].includes(existingBooking.status)) {
            return { statusCode: 409, headers, body: JSON.stringify({ error: 'This booking can no longer be cancelled' }) };
          }
        }

        const updateFields = [];
        const updateParams = [];
        let paramCount = 1;

        const setField = (col, val) => {
          updateFields.push(`${col} = $${paramCount++}`);
          updateParams.push(val);
        };

        // High-level flags from UI
        if (updateData.accept === true) {
          setField('status', 'confirmed');
        }

        if (updateData.cancel === true) {
          setField('status', 'cancelled');
          if (updateData.cancellation_reason !== undefined) {
            setField('cancellation_reason', updateData.cancellation_reason);
          }
        }

        if (isAdmin && updateData.status !== undefined) setField('status', updateData.status);
        if (updateData.booking_date !== undefined) setField('booking_date', updateData.booking_date);
        if (updateData.duration !== undefined) setField('duration', updateData.duration);
        if (updateData.reschedule_requested_by !== undefined) setField('reschedule_requested_by', updateData.reschedule_requested_by);
        if (updateData.reschedule_proposed_date !== undefined) setField('reschedule_proposed_date', updateData.reschedule_proposed_date);
        if (updateData.reschedule_status !== undefined) setField('reschedule_status', updateData.reschedule_status);
        if (updateData.reschedule_requested_at !== undefined) setField('reschedule_requested_at', updateData.reschedule_requested_at);
        if (updateData.location_type !== undefined) setField('location_type', updateData.location_type);
        if (updateData.location_address !== undefined) setField('location_address', updateData.location_address);
        if (updateData.location_notes !== undefined) setField('location_notes', updateData.location_notes);
        if (updateData.client_notes !== undefined) setField('client_notes', updateData.client_notes);
        if (updateData.notes !== undefined) setField('notes', updateData.notes);
        if (updateData.service_type !== undefined) setField('service_type', updateData.service_type);
        if (updateData.cancellation_reason !== undefined && !updateData.cancel) {
          // Allow direct reason update even if cancel flag wasn't set in this payload
          setField('cancellation_reason', updateData.cancellation_reason);
        }

        if (updateFields.length === 0) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
        }

        updateFields.push(`updated_at = NOW()`);
        updateParams.push(bookingId);

        const baseUpdateQuery = `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const finalUpdateQuery = currentUserId ? withUserCtx(baseUpdateQuery, currentUserId) : baseUpdateQuery;

        const updatedBooking = await executeQueryOne(
          finalUpdateQuery,
          updateParams
        );

        if (!updatedBooking) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking not found' }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify(updatedBooking) };
      }

      case 'PATCH': {
        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }
        // PATCH /bookings/:id/archive OR /bookings/:id/restore
        if (!bookingId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Booking ID is required' }) };
        }

        if (action !== 'archive' && action !== 'restore') {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid PATCH action. Use /archive or /restore.' }) };
        }

        if (!isAdmin) {
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
            [bookingId, currentUserId]
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
        if (!currentUserId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
        }
        if (!isAdmin) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
        }
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
    captureFunctionError(error, {
      route: 'bookings',
      method: event.httpMethod,
      path: event.path
    });
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
};

export const handler = withFunctionObservability('bookings', rawHandler);
