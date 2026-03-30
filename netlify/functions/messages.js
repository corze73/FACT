/* eslint-env node */
import { executeQuery, executeQueryOne } from './lib/db.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { getAuthContext } from './lib/auth.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';

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

const isMissingRelationError = (error, relationName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(`relation \"${relationName}\" does not exist`) || message.includes(`relation '${relationName}' does not exist`);
};

/**
 * Netlify Function: Message Operations
 * Endpoints:
 * - GET /api/messages?booking_id=:id - Get messages for a booking
 * - POST /api/messages - Create message
 * - PUT /api/messages/:id - Mark message as read
 */
const rawHandler = async (event) => {
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
      const ctxCte = `__ctx AS (SELECT set_config('app.current_user_id', '${safe}', true))`;
      const trimmed = String(query || '').trimStart();

      // If the query already starts with a CTE, prepend __ctx as the first CTE.
      if (/^WITH\b/i.test(trimmed)) {
        return trimmed.replace(/^WITH\s+/i, `WITH ${ctxCte}, `);
      }

      return `WITH ${ctxCte} ${trimmed}`;
    };

    const tableExists = async (tableName) => {
      const row = await executeQueryOne('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
      return Boolean(row?.table_name);
    };

    const logMessageAction = async ({ action, targetUserId = null, metadata = {} }) => {
      if (!(await tableExists('admin_action_logs'))) return;
      await executeQuery(
        withUserCtx(
          `INSERT INTO admin_action_logs (actor_user_id, action, target_user_id, metadata, created_at)
           VALUES ($1, $2, $3, $4::jsonb, NOW())`,
          currentUserId
        ),
        [currentUserId, action, targetUserId, JSON.stringify(metadata)]
      );
    };

    const archiveDeletedMessages = async ({ rows, deletionScope, metadata = {} }) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      if (!(await tableExists('deleted_messages'))) return;

      await Promise.all(
        rows.map((row) => executeQuery(
          withUserCtx(
            `INSERT INTO deleted_messages (
              original_message_id,
              booking_id,
              sender_id,
              receiver_id,
              content,
              created_date,
              updated_at,
              is_read,
              deleted_by_user_id,
              deleted_at,
              deletion_scope,
              metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11::jsonb
            )`,
            currentUserId
          ),
          [
            row.id,
            row.booking_id,
            row.sender_id,
            row.receiver_id,
            row.content,
            row.created_date,
            row.updated_at,
            row.is_read,
            currentUserId,
            deletionScope,
            JSON.stringify(metadata)
          ]
        ))
      );
    };

    switch (event.httpMethod) {
      case 'GET': {
        // 0) List deleted messages archive for current user
        if (queryStringParameters?.deleted === '1') {
          const limitRaw = Number(queryStringParameters?.limit ?? 50);
          const offsetRaw = Number(queryStringParameters?.offset ?? 0);
          const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100 ? limitRaw : 50;
          const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

          const conditions = ['dm.deleted_by_user_id = $1'];
          const params = [currentUserId];

          if (queryStringParameters?.booking_id) {
            conditions.push(`dm.booking_id = $${params.length + 1}`);
            params.push(queryStringParameters.booking_id);
          }

          if (queryStringParameters?.direct_user_id) {
            const directId = queryStringParameters.direct_user_id;
            conditions.push(`(
              (dm.sender_id = $${params.length + 1} AND dm.receiver_id = $1)
              OR
              (dm.sender_id = $1 AND dm.receiver_id = $${params.length + 1})
            )`);
            params.push(directId);
          }

          const query = `
            SELECT dm.*,
                   s.full_name AS sender_name,
                 r.full_name AS receiver_name,
                 (m.id IS NOT NULL) AS message_still_exists
            FROM deleted_messages dm
            LEFT JOIN profiles s ON s.id = dm.sender_id
            LEFT JOIN profiles r ON r.id = dm.receiver_id
               LEFT JOIN messages m ON m.id = dm.original_message_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY dm.deleted_at DESC
            LIMIT ${limit} OFFSET ${offset}`;

          let rows = [];
          try {
            rows = await executeQuery(withUserCtx(query, currentUserId), params);
          } catch (error) {
            if (!isMissingRelationError(error, 'deleted_messages')) throw error;
          }
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(rows)
          };
        }

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
              AND NOT ((m.sender_id = $2 AND m.deleted_by_sender_at IS NOT NULL)
                OR (m.receiver_id = $2 AND m.deleted_by_receiver_at IS NOT NULL))
            ORDER BY m.created_date ASC`;

          const finalQuery = currentUserId ? withUserCtx(baseQuery, currentUserId) : baseQuery;
          const messages = await executeQuery(finalQuery, [queryStringParameters.booking_id, currentUserId]);

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
              AND NOT ((m.sender_id = $1 AND m.deleted_by_sender_at IS NOT NULL)
                OR (m.receiver_id = $1 AND m.deleted_by_receiver_at IS NOT NULL))
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
                AND NOT ((m.sender_id = $1 AND m.deleted_by_sender_at IS NOT NULL)
                  OR (m.receiver_id = $1 AND m.deleted_by_receiver_at IS NOT NULL))
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
        if (queryStringParameters?.restore_archive_id) {
          const archiveId = queryStringParameters.restore_archive_id;

          let archivedRow = null;
          try {
            archivedRow = await executeQueryOne(
              withUserCtx(
                `SELECT *
                 FROM deleted_messages
                 WHERE id = $1
                   AND deleted_by_user_id = $2`,
                currentUserId
              ),
              [archiveId, currentUserId]
            );
          } catch (error) {
            if (!isMissingRelationError(error, 'deleted_messages')) throw error;
          }

          if (!archivedRow) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Deleted message record not found' })
            };
          }

          const restoredMessage = await executeQueryOne(
            withUserCtx(
              `UPDATE messages
               SET deleted_by_sender_at = CASE WHEN sender_id = $2 THEN NULL ELSE deleted_by_sender_at END,
                   deleted_by_receiver_at = CASE WHEN receiver_id = $2 THEN NULL ELSE deleted_by_receiver_at END,
                   updated_at = NOW()
               WHERE id = $1
                 AND (sender_id = $2 OR receiver_id = $2)
               RETURNING *`,
              currentUserId
            ),
            [archivedRow.original_message_id, currentUserId]
          );

          if (!restoredMessage) {
            return {
              statusCode: 409,
              headers,
              body: JSON.stringify({ error: 'Message can no longer be restored' })
            };
          }

          try {
            await executeQuery(
              withUserCtx(
                `DELETE FROM deleted_messages
                 WHERE original_message_id = $1
                   AND deleted_by_user_id = $2`,
                currentUserId
              ),
              [archivedRow.original_message_id, currentUserId]
            );
          } catch (error) {
            if (!isMissingRelationError(error, 'deleted_messages')) throw error;
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(restoredMessage)
          };
        }

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

      case 'DELETE': {
        if (queryStringParameters?.deleted_archive_id) {
          const archiveId = queryStringParameters.deleted_archive_id;
          let deleted = null;
          try {
            deleted = await executeQueryOne(
              withUserCtx(
                `DELETE FROM deleted_messages
                 WHERE id = $1
                   AND deleted_by_user_id = $2
                 RETURNING id`,
                currentUserId
              ),
              [archiveId, currentUserId]
            );
          } catch (error) {
            if (!isMissingRelationError(error, 'deleted_messages')) throw error;
          }

          if (!deleted) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Deleted message record not found' })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true })
          };
        }

        if (messageId && messageId !== 'messages') {
          const baseSelect = `
            SELECT *
            FROM messages
            WHERE id = $1
              AND (sender_id = $2 OR receiver_id = $2)`;

          const targetMessage = await executeQueryOne(
            withUserCtx(baseSelect, currentUserId),
            [messageId, currentUserId]
          );

          if (!targetMessage) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Message not found' })
            };
          }

          const targetUserId = targetMessage.sender_id === currentUserId
            ? targetMessage.receiver_id
            : targetMessage.sender_id;

          const updateQuery = `
            UPDATE messages
            SET deleted_by_sender_at = CASE WHEN sender_id = $2 THEN NOW() ELSE deleted_by_sender_at END,
                deleted_by_receiver_at = CASE WHEN receiver_id = $2 THEN NOW() ELSE deleted_by_receiver_at END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *`;

          const updatedMessage = await executeQueryOne(
            withUserCtx(updateQuery, currentUserId),
            [messageId, currentUserId]
          );

          await archiveDeletedMessages({
            rows: [updatedMessage || targetMessage],
            deletionScope: 'single',
            metadata: {
              action: 'message_deleted',
              target_user_id: targetUserId
            }
          });

          await logMessageAction({
            action: 'message_deleted',
            targetUserId,
            metadata: {
              message_id: targetMessage.id,
              booking_id: targetMessage.booking_id,
              content: targetMessage.content,
              sender_id: targetMessage.sender_id,
              receiver_id: targetMessage.receiver_id,
              created_date: targetMessage.created_date
            }
          });

          await executeQuery(
            withUserCtx(
              `DELETE FROM messages
               WHERE id = $1
                 AND deleted_by_sender_at IS NOT NULL
                 AND deleted_by_receiver_at IS NOT NULL`,
              currentUserId
            ),
            [messageId]
          );

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true, deleted: 1 })
          };
        }

        const hasBookingConversation = Boolean(queryStringParameters?.booking_id);
        const hasDirectConversation = Boolean(queryStringParameters?.direct_user_id);

        if (!hasBookingConversation && !hasDirectConversation) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Message ID, booking_id, or direct_user_id is required' })
          };
        }

        let deletedRows = [];
        let targetUserId = null;

        if (hasBookingConversation) {
          const conversationBookingId = queryStringParameters.booking_id;
          const baseUpdate = `
            UPDATE messages
            SET deleted_by_sender_at = CASE WHEN sender_id = $2 THEN NOW() ELSE deleted_by_sender_at END,
                deleted_by_receiver_at = CASE WHEN receiver_id = $2 THEN NOW() ELSE deleted_by_receiver_at END,
                updated_at = NOW()
            WHERE booking_id = $1
              AND (sender_id = $2 OR receiver_id = $2)
            RETURNING *`;

          deletedRows = await executeQuery(
            withUserCtx(baseUpdate, currentUserId),
            [conversationBookingId, currentUserId]
          );

          const booking = await executeQueryOne(
            withUserCtx('SELECT client_id, coach_id FROM bookings WHERE id = $1', currentUserId),
            [conversationBookingId]
          );
          if (booking) {
            targetUserId = booking.client_id === currentUserId ? booking.coach_id : booking.client_id;
          }

          await archiveDeletedMessages({
            rows: deletedRows,
            deletionScope: 'conversation_clear',
            metadata: {
              action: 'message_conversation_cleared',
              booking_id: conversationBookingId,
              target_user_id: targetUserId,
              deleted_count: deletedRows.length,
              mode: 'booking'
            }
          });

          await logMessageAction({
            action: 'message_conversation_cleared',
            targetUserId,
            metadata: {
              booking_id: conversationBookingId,
              deleted_count: deletedRows.length,
              mode: 'booking'
            }
          });

          await executeQuery(
            withUserCtx(
              `DELETE FROM messages
               WHERE booking_id = $1
                 AND deleted_by_sender_at IS NOT NULL
                 AND deleted_by_receiver_at IS NOT NULL`,
              currentUserId
            ),
            [conversationBookingId]
          );
        } else {
          const otherUserId = queryStringParameters.direct_user_id;
          targetUserId = otherUserId;
          const baseUpdate = `
            UPDATE messages
            SET deleted_by_sender_at = CASE WHEN sender_id = $1 THEN NOW() ELSE deleted_by_sender_at END,
                deleted_by_receiver_at = CASE WHEN receiver_id = $1 THEN NOW() ELSE deleted_by_receiver_at END,
                updated_at = NOW()
            WHERE booking_id IS NULL
              AND (
                (sender_id = $1 AND receiver_id = $2) OR
                (sender_id = $2 AND receiver_id = $1)
              )
            RETURNING *`;

          deletedRows = await executeQuery(
            withUserCtx(baseUpdate, currentUserId),
            [currentUserId, otherUserId]
          );

          await archiveDeletedMessages({
            rows: deletedRows,
            deletionScope: 'conversation_clear',
            metadata: {
              action: 'message_conversation_cleared',
              direct_user_id: otherUserId,
              target_user_id: otherUserId,
              deleted_count: deletedRows.length,
              mode: 'direct'
            }
          });

          await logMessageAction({
            action: 'message_conversation_cleared',
            targetUserId,
            metadata: {
              direct_user_id: otherUserId,
              deleted_count: deletedRows.length,
              mode: 'direct'
            }
          });

          await executeQuery(
            withUserCtx(
              `DELETE FROM messages
               WHERE booking_id IS NULL
                 AND (
                   (sender_id = $1 AND receiver_id = $2) OR
                   (sender_id = $2 AND receiver_id = $1)
                 )
                 AND deleted_by_sender_at IS NOT NULL
                 AND deleted_by_receiver_at IS NOT NULL`,
              currentUserId
            ),
            [currentUserId, otherUserId]
          );
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true, deleted: deletedRows.length })
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
    captureFunctionError(error, {
      route: 'messages',
      method: event.httpMethod,
      path: event.path
    });
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
};

export const handler = withFunctionObservability('messages', rawHandler);
