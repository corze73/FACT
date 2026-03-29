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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);

const VALID_ROLES = ['coach', 'client', 'admin', 'both'];

export const handler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    // Public read — active FAQs ordered by position.
    // Admin can request include_inactive=1 to see all entries.
    let includeInactive = false;
    if (event.queryStringParameters?.include_inactive === '1') {
      const auth = await getAuthContext(event);
      includeInactive = auth?.isAdmin === true;
    }

    const rows = await executeQuery(
      `SELECT id, slug, role, category, question, answer, keywords, position, is_active
         FROM help_faqs
        WHERE ($1 OR is_active = true)
        ORDER BY position ASC, created_at ASC`,
      [includeInactive]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ faqs: rows })
    };
  }

  // POST / PUT / DELETE all require admin auth
  const auth = await getAuthContext(event);
  if (!auth?.isAdmin) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
  }

  if (event.httpMethod === 'POST') {
    const body = parseBody(event);
    const { slug, role, category, question, answer, keywords, position } = body;

    if (!slug || !role || !category || !question || !answer) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: slug, role, category, question, answer' }) };
    }
    if (!VALID_ROLES.includes(role)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid role' }) };
    }

    const safeKeywords = Array.isArray(keywords)
      ? keywords.map((k) => String(k).slice(0, 100))
      : [];
    const safePosition = Number.isInteger(Number(position)) ? Number(position) : 0;

    const row = await executeQueryOne(
      `INSERT INTO help_faqs (slug, role, category, question, answer, keywords, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        String(slug).slice(0, 120),
        role,
        String(category).slice(0, 60),
        String(question).slice(0, 600),
        String(answer).slice(0, 3000),
        safeKeywords,
        safePosition
      ]
    );

    return { statusCode: 201, headers, body: JSON.stringify({ faq: row }) };
  }

  if (event.httpMethod === 'PUT') {
    const faqId = event.queryStringParameters?.id;
    if (!isUuid(faqId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or missing id' }) };
    }

    const body = parseBody(event);
    const { role, category, question, answer, keywords, position, is_active } = body;

    const updates = [];
    const params = [];

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid role' }) };
      }
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(String(category).slice(0, 60));
      updates.push(`category = $${params.length}`);
    }
    if (question !== undefined) {
      params.push(String(question).slice(0, 600));
      updates.push(`question = $${params.length}`);
    }
    if (answer !== undefined) {
      params.push(String(answer).slice(0, 3000));
      updates.push(`answer = $${params.length}`);
    }
    if (keywords !== undefined) {
      const safeKw = Array.isArray(keywords)
        ? keywords.map((k) => String(k).slice(0, 100))
        : [];
      params.push(safeKw);
      updates.push(`keywords = $${params.length}`);
    }
    if (position !== undefined) {
      params.push(Number(position) || 0);
      updates.push(`position = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(Boolean(is_active));
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
    }

    params.push(faqId);
    const row = await executeQueryOne(
      `UPDATE help_faqs
          SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${params.length}
        RETURNING *`,
      params
    );

    if (!row) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'FAQ not found' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ faq: row }) };
  }

  if (event.httpMethod === 'DELETE') {
    const faqId = event.queryStringParameters?.id;
    if (!isUuid(faqId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or missing id' }) };
    }

    const row = await executeQueryOne(
      `UPDATE help_faqs
          SET is_active = false, updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [faqId]
    );

    if (!row) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'FAQ not found' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
