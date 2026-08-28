/* eslint-env node */
import nodemailer from 'nodemailer';
import { executeQuery, executeQueryOne } from './lib/db.js';
import { getAuthContext } from './lib/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';

const CATEGORIES = new Set(['account', 'booking', 'payments', 'verification', 'technical', 'complaint', 'other']);
const URGENT_TERMS = /\b(child|minor|unsafe|abuse|groom|threat|assault|harass|injur|immediate danger|self[- ]?harm|suicid)/i;

const headersFor = (event) => ({
  'Access-Control-Allow-Origin': ['https://findacoachtoday.com', 'https://www.findacoachtoday.com', 'http://localhost:5173', 'http://localhost:8888'].includes(event.headers?.origin)
    ? event.headers.origin : 'https://findacoachtoday.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const notifySupport = async ({ reference, email, name, category, subject, description }) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  const transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user, pass }
  });
  const to = process.env.VITE_SUPPORT_EMAIL || process.env.ADMIN_EMAIL || 'support@findacoachtoday.com';
  await transporter.sendMail({
    from: `"FACT Support Assistant" <${user}>`, to,
    replyTo: email,
    subject: `[${reference}] ${subject}`,
    text: `Support case: ${reference}\nUser: ${name} <${email}>\nCategory: ${category}\n\n${description}`
  });
  return true;
};

const rawHandler = async (event) => {
  const headers = headersFor(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  const limited = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
  if (limited) return limited;

  try {
    const auth = await getAuthContext(event);
    if (!auth?.userId) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Please sign in to contact support' }) };
    const body = JSON.parse(event.body || '{}');
    const category = String(body.category || 'other').trim();
    const subject = String(body.subject || 'Support request').trim().slice(0, 160);
    const description = String(body.description || '').trim().slice(0, 6000);
    const latestUserMessage = String(body.latest_user_message || '').trim().slice(0, 1000);
    const bookingId = typeof body.booking_id === 'string' && /^[0-9a-fA-F-]{36}$/.test(body.booking_id) ? body.booking_id : null;
    const transcriptConsent = body.transcript_consent === true;
    if (!CATEGORIES.has(category)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Select a valid support category' }) };
    if (description.length < 15) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please provide at least 15 characters' }) };
    if (!transcriptConsent) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please consent to sending this conversation to support' }) };
    if (URGENT_TERMS.test(latestUserMessage)) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'This may be a safeguarding concern. Please use the safeguarding report so it reaches the safeguarding team immediately.', safeguarding: true }) };
    }

    const profile = await executeQueryOne('SELECT id, full_name, email FROM profiles WHERE id = $1', [auth.userId]);
    if (!profile) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) };
    const caseDescription = `Submitted by FACT Support Assistant\nCategory: ${category}\n\n${description}`;
    const created = await executeQueryOne(
      `INSERT INTO admin_cases (title, description, status, priority, category, target_user_id, booking_id, created_by, created_at, updated_at)
       VALUES ($1, $2, 'open', 'normal', 'support', $3, $4, $3, NOW(), NOW())
       RETURNING id, status, created_at`,
      [subject, caseDescription, auth.userId, bookingId]
    );
    const reference = `FACT-${String(created.id).split('-')[0].toUpperCase()}`;
    await executeQuery(
      `INSERT INTO admin_action_logs (actor_user_id, action, target_user_id, metadata, created_at)
       VALUES ($1, 'support_request_submitted', $1, $2::jsonb, NOW())`,
      [auth.userId, JSON.stringify({ case_id: created.id, reference, category })]
    );
    let emailSent = false;
    try {
      emailSent = await notifySupport({ reference, email: profile.email, name: profile.full_name, category, subject, description });
    } catch (emailError) {
      captureFunctionError(emailError, { route: 'support', stage: 'email', caseId: created.id });
    }
    return { statusCode: 201, headers, body: JSON.stringify({ data: { ...created, reference, email_sent: emailSent }, message: `Your request has been sent to FACT Support. Reference: ${reference}` }) };
  } catch (error) {
    captureFunctionError(error, { route: 'support' });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to send your support request' }) };
  }
};

export const handler = withFunctionObservability('support', rawHandler);
