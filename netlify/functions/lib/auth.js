/* eslint-env node */
import crypto from 'crypto';
import { executeQueryOne } from './db.js';

const base64UrlDecode = (input) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf-8');
};

const getBearerToken = (headers = {}) => {
  const raw = headers.authorization || headers.Authorization || '';
  if (!raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length).trim();
};

const timingSafeEqual = (a, b) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const verifyAuthToken = (token) => {
  if (!token) return null;
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) {
    throw new Error('APP_JWT_SECRET is not set');
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }

  if (header?.alg !== 'HS256') return null;

  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  if (!timingSafeEqual(signature, signatureB64)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now) return null;

  return payload;
};

export const getAuthPayload = (event) => {
  const token = getBearerToken(event.headers || {});
  if (!token) return null;
  return verifyAuthToken(token);
};

const withUserCtx = (query, ctxId) => {
  const safe = (ctxId || '').match(/^[0-9a-fA-F-]{36}$/) ? ctxId : '';
  return `WITH __ctx AS (SELECT set_config('app.current_user_id', '${safe}', true)) ${query}`;
};

export const getAuthContext = async (event) => {
  const payload = getAuthPayload(event);
  if (!payload?.sub) return { userId: null, role: null, payload: null };

  const profile = await executeQueryOne(
    withUserCtx('SELECT role, is_active FROM profiles WHERE id = $1', payload.sub),
    [payload.sub]
  );

  return {
    userId: payload.sub,
    role: profile?.role || payload.role || null,
    isActive: profile?.is_active !== false,
    payload
  };
};

export const signAuthToken = (payload, { expiresInSeconds = 60 * 60 * 24 * 7 } = {}) => {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) {
    throw new Error('APP_JWT_SECRET is not set');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    aud: 'authenticated',
    iat: now,
    exp: now + expiresInSeconds,
    ...payload
  };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = encode(header);
  const payloadB64 = encode(fullPayload);
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${signature}`;
};
