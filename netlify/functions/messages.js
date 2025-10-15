import { executeQuery, executeQueryOne } from './lib/db.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Netlify Function: Message Operations
 * Endpoints:
 * - GET /api/messages?booking_id=:id - Get messages for a booking
 * - POST /api/messages - Create message
 * - PUT /api/messages/:id - Mark message as read
 */
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { body, path, queryStringParameters } = event;
    const pathParts = path.split('/').filter(Boolean);
    const messageId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null;

    switch (event.httpMethod) {
      case 'GET': {
        // Get messages for a booking
        if (!queryStringParameters?.booking_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'booking_id is required' })
          };
        }

        const messages = await executeQuery(
          `SELECT m.*,
                  s.full_name as sender_name, s.avatar_url as sender_avatar,
                  r.full_name as receiver_name, r.avatar_url as receiver_avatar
           FROM messages m
           LEFT JOIN profiles s ON m.sender_id = s.id
           LEFT JOIN profiles r ON m.receiver_id = r.id
           WHERE m.booking_id = $1
           ORDER BY m.created_date ASC`,
          [queryStringParameters.booking_id]
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(messages)
        };
      }

      case 'POST': {
        // Create new message
        const messageData = JSON.parse(body);

        // Validate required fields
        if (!messageData.booking_id || !messageData.sender_id || !messageData.receiver_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'booking_id, sender_id, and receiver_id are required' 
            })
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

        const newMessage = await executeQueryOne(
          `INSERT INTO messages (booking_id, sender_id, receiver_id, content, is_read)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            messageData.booking_id,
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

        const updatedMessage = await executeQueryOne(
          `UPDATE messages
           SET is_read = COALESCE($1, is_read),
               updated_date = NOW()
           WHERE id = $2
           RETURNING *`,
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
