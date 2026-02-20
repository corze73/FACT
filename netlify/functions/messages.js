/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { getAuthContext } from './lib/auth.js';

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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

/**
 * Netlify Function: Message Operations
 * Endpoints:
 * - GET /api/messages?booking_id=:id - Get messages for a booking
 * - POST /api/messages - Create message
 * - PUT /api/messages/:id - Mark message as read
 */
export async function handler(event) {
  const headers = getHeaders(event);
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Apply messaging rate limit
  const rateLimitResponse = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { body, path, queryStringParameters } = event;
    const pathParts = path.split('/').filter(Boolean);
    const messageId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;

    const auth = await getAuthContext(event);
    const currentUserId = auth.userId;
    const isAdmin = auth.isAdmin === true;

    if (!currentUserId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const withUserCtx = (query, ctxId) => {
      const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
      return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
    };

    switch (event.httpMethod) {
      case 'GET': {
        // 1) Conversation for a specific booking
        if (queryStringParameters?.booking_id) {
          const baseQuery = `
            SELECT m.*,
                   s.full_name as sender_name, s.avatar_url as sender_avatar,
                   r.full_name as receiver_name, r.avatar_url as receiver_avatar
            FROM messages m
            LEFT JOIN profiles s ON m.sender_id = s.id
            LEFT JOIN profiles r ON m.receiver_id = r.id
            WHERE m.booking_id = $1
            ORDER BY m.created_date ASC`;

          const finalQuery = currentUserId ? withUserCtx(baseQuery, currentUserId) : baseQuery;
          const messages = await executeQuery(finalQuery, [queryStringParameters.booking_id]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(messages)
          };
        }

        // 2) Direct admin ↔ user conversation (no booking)
        if (queryStringParameters?.direct_user_id) {
          if (!currentUserId) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Current user context is required for direct messages' })
            };
          }

          const baseQuery = `
            SELECT m.*,
                   s.full_name as sender_name, s.avatar_url as sender_avatar,
                   r.full_name as receiver_name, r.avatar_url as receiver_avatar
            FROM messages m
            LEFT JOIN profiles s ON m.sender_id = s.id
            LEFT JOIN profiles r ON m.receiver_id = r.id
            WHERE m.booking_id IS NULL
              AND (
                (m.sender_id = $1 AND m.receiver_id = $2) OR
                (m.sender_id = $2 AND m.receiver_id = $1)
              )
            ORDER BY m.created_date ASC`;

          const finalQuery = withUserCtx(baseQuery, currentUserId);
          const messages = await executeQuery(finalQuery, [currentUserId, queryStringParameters.direct_user_id]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(messages)
          };
        }

        // 3) List direct-message threads for current user (no booking)
        if (queryStringParameters?.direct_threads === '1') {
          if (!currentUserId) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Current user context is required for direct threads' })
            };
          }

          const baseQuery = `
            WITH base AS (
              SELECT m.*,
                     CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id
              FROM messages m
              WHERE m.booking_id IS NULL
                AND (m.sender_id = $1 OR m.receiver_id = $1)
            )
            SELECT DISTINCT ON (other_user_id)
              id,
              booking_id,
              sender_id,
              receiver_id,
              content,
              created_date,
              updated_at,
              is_read,
              other_user_id
            FROM base
            ORDER BY other_user_id, created_date DESC`;

          const finalQuery = withUserCtx(baseQuery, currentUserId);
          const threads = await executeQuery(finalQuery, [currentUserId]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(threads)
          };
        }

        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Either booking_id or direct_user_id is required' })
        };
      }

      case 'POST': {
        // Create new message
        const messageData = JSON.parse(body);

        // Validate required fields
        if (!messageData.sender_id || !messageData.receiver_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'sender_id and receiver_id are required' 
            })
          };
        }

        if (!isAdmin && messageData.sender_id !== currentUserId) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Cannot send messages as another user' })
          };
        }

        if (!messageData.content || messageData.content.trim().length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Message content is required' })
          };
        }

        // Server-side content length validation
        if (messageData.content.length > 5000) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Message too long (max 5000 characters)' })
          };
        }

          const baseInsert = `
            INSERT INTO messages (booking_id, sender_id, receiver_id, content, is_read)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;

          const finalInsert = currentUserId ? withUserCtx(baseInsert, currentUserId) : baseInsert;

          const newMessage = await executeQueryOne(
            finalInsert,
            [
              messageData.booking_id || null,
              messageData.sender_id,
              messageData.receiver_id,
              messageData.content.trim(),
              messageData.is_read || false
            ]
          );

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newMessage)
        };
      }

      case 'PUT': {
        // Update message (typically to mark as read)
        if (!messageId || messageId === 'messages') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Message ID is required' })
          };
        }

        const updateData = JSON.parse(body);

        const baseUpdate = `
          UPDATE messages
          SET is_read = COALESCE($1, is_read),
              updated_date = NOW()
          WHERE id = $2
          RETURNING *`;

        const finalUpdate = currentUserId ? withUserCtx(baseUpdate, currentUserId) : baseUpdate;

        const updatedMessage = await executeQueryOne(
          finalUpdate,
          [updateData.is_read, messageId]
        );

        if (!updatedMessage) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Message not found' })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedMessage)
        };
      }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error in messages function:', error);
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
