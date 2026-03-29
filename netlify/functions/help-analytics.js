/* eslint-env node */
import { Buffer } from 'buffer';
import { executeQuery, executeQueryOne } from './lib/db.js';
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;
  return JSON.parse(raw);
};

const ALLOWED_EVENT_TYPES = ['search', 'faq_view', 'category_select', 'no_results'];

export const handler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'POST') {
    const body = parseBody(event);
    const eventType = String(body.event_type || '').slice(0, 50);
    const role = String(body.role || '').slice(0, 20);
    const faqId = String(body.faq_id || '').slice(0, 100);
    const searchTerm = String(body.search_term || '').slice(0, 200);
    const category = String(body.category || '').slice(0, 50);

    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid event_type' }) };
    }

    let userId = null;
    try {
      const auth = await getAuthContext(event);
      userId = auth?.userId || null;
    } catch {
      // Not authenticated — record event without user_id
    }

    await executeQuery(
      `INSERT INTO help_analytics (event_type, role, faq_id, search_term, category, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        eventType,
        role || null,
        faqId || null,
        searchTerm || null,
        category || null,
        userId
      ]
    );

    return { statusCode: 201, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod === 'GET') {
    const auth = await getAuthContext(event);
    if (!auth?.isAdmin) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const rawDays = Number(event.queryStringParameters?.days ?? 30);
    const days = Math.min(Math.max(1, Math.floor(isNaN(rawDays) ? 30 : rawDays)), 90);

    const [topSearches, topFaqs, topCategories, eventSummary, totalRow] = await Promise.all([
      executeQuery(
        `SELECT search_term, COUNT(*)::int AS count
           FROM help_analytics
          WHERE event_type = 'search'
            AND search_term IS NOT NULL AND search_term <> ''
            AND created_at > now() - ($1 || ' days')::interval
          GROUP BY search_term
          ORDER BY count DESC
          LIMIT 10`,
        [String(days)]
      ),
      executeQuery(
        `SELECT faq_id, COUNT(*)::int AS count
           FROM help_analytics
          WHERE event_type = 'faq_view'
            AND faq_id IS NOT NULL AND faq_id <> ''
            AND created_at > now() - ($1 || ' days')::interval
          GROUP BY faq_id
          ORDER BY count DESC
          LIMIT 10`,
        [String(days)]
      ),
      executeQuery(
        `SELECT category, COUNT(*)::int AS count
           FROM help_analytics
          WHERE event_type = 'category_select'
            AND category IS NOT NULL AND category <> ''
            AND created_at > now() - ($1 || ' days')::interval
          GROUP BY category
          ORDER BY count DESC
          LIMIT 10`,
        [String(days)]
      ),
      executeQuery(
        `SELECT event_type, COUNT(*)::int AS count
           FROM help_analytics
          WHERE created_at > now() - ($1 || ' days')::interval
          GROUP BY event_type`,
        [String(days)]
      ),
      executeQueryOne(
        `SELECT COUNT(*)::int AS total
           FROM help_analytics
          WHERE created_at > now() - ($1 || ' days')::interval`,
        [String(days)]
      )
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        topSearches,
        topFaqs,
        topCategories,
        eventSummary,
        totalEvents: Number(totalRow?.total || 0),
        days
      })
    };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
