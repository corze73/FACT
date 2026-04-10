/* eslint-env node */
import crypto from 'crypto';
import * as Sentry from '@sentry/node';

let sentryInitialized = false;

const isLocalFunctionDev = () =>
  process.env.NETLIFY_DEV === 'true' ||
  process.env.NETLIFY_LOCAL === 'true' ||
  process.env.URL === 'http://localhost:8888';

const getRelease = () =>
  process.env.SENTRY_RELEASE || process.env.APP_VERSION || process.env.COMMIT_REF || 'dev';
const getEnvironment = () =>
  process.env.SENTRY_ENVIRONMENT ||
  process.env.APP_ENV ||
  process.env.CONTEXT ||
  process.env.NODE_ENV ||
  'development';

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const shouldRedactKey = (key) => {
  const lowered = String(key || '').toLowerCase();
  return [
    'authorization',
    'cookie',
    'token',
    'password',
    'secret',
    'signature',
    'email',
    'phone',
    'set-cookie'
  ].some((needle) => lowered.includes(needle));
};

const sanitizeValue = (value, depth = 0) => {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = shouldRedactKey(key) ? '[redacted]' : sanitizeValue(val, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') {
    if (value.length > 500) return `${value.slice(0, 500)}...[truncated]`;
    return value;
  }
  return value;
};

const decodeAuthPayload = (event) => {
  const rawHeader = event?.headers?.authorization || event?.headers?.Authorization || '';
  if (!rawHeader.startsWith('Bearer ')) {
    return { userId: null, isAdmin: false };
  }

  try {
    const token = rawHeader.slice('Bearer '.length).trim();
    const parts = token.split('.');
    if (parts.length !== 3) return { userId: null, isAdmin: false };
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
    return {
      userId: payload?.sub || null,
      isAdmin: payload?.user_type === 'admin'
    };
  } catch {
    return { userId: null, isAdmin: false };
  }
};

export function initServerMonitoring() {
  if (sentryInitialized) return;

  if (isLocalFunctionDev()) {
    console.log('Sentry disabled for local Netlify dev');
    sentryInitialized = true;
    return;
  }

  const dsn = process.env.SENTRY_DSN_SERVER || process.env.SENTRY_DSN;
  console.log(`Sentry enabled: ${Boolean(dsn)}`);
  if (!dsn) {
    sentryInitialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment: getEnvironment(),
    release: getRelease(),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
  });

  sentryInitialized = true;
}

export function captureFunctionError(error, context = {}) {
  initServerMonitoring();
  const dsn = process.env.SENTRY_DSN_SERVER || process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.withScope((scope) => {
    scope.setTag('environment', getEnvironment());
    scope.setTag('release', getRelease());
    const safe = sanitizeValue(context);
    for (const [key, value] of Object.entries(safe || {})) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}

const logJson = (payload) => {
  console.log(JSON.stringify(sanitizeValue(payload)));
};

export function withFunctionObservability(route, fn) {
  return async (event, context) => {
    initServerMonitoring();
    const startedAt = Date.now();
    const requestId = event?.headers?.['x-request-id'] || crypto.randomUUID();
    const authMeta = decodeAuthPayload(event);

    try {
      const response = await fn(event, context);
      const statusCode = Number(response?.statusCode || 200);
      logJson({
        level: 'info',
        type: 'function_request',
        request_id: requestId,
        route,
        method: event?.httpMethod || 'UNKNOWN',
        user_id: authMeta.userId,
        is_admin: authMeta.isAdmin,
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        environment: getEnvironment(),
        release: getRelease()
      });
      return response;
    } catch (error) {
      captureFunctionError(error, {
        request_id: requestId,
        route,
        method: event?.httpMethod || 'UNKNOWN',
        user_id: authMeta.userId,
        is_admin: authMeta.isAdmin
      });

      logJson({
        level: 'error',
        type: 'function_request',
        request_id: requestId,
        route,
        method: event?.httpMethod || 'UNKNOWN',
        user_id: authMeta.userId,
        is_admin: authMeta.isAdmin,
        status_code: 500,
        duration_ms: Date.now() - startedAt,
        error_name: error?.name || 'Error',
        error_message: error?.message || 'Unknown error',
        environment: getEnvironment(),
        release: getRelease()
      });

      throw error;
    }
  };
}

export function getBuildMeta() {
  return {
    release: getRelease(),
    environment: getEnvironment()
  };
}
