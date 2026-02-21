import * as Sentry from '@sentry/browser';

let initialized = false;

const getEnvironment = () => import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';
const getRelease = () => import.meta.env.VITE_APP_VERSION || 'dev';

export function initFrontendMonitoring() {
  if (initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    initialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment: getEnvironment(),
    release: getRelease(),
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1)
  });

  initialized = true;
}

export function captureFrontendError(error, context = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    scope.setTag('environment', getEnvironment());
    scope.setTag('release', getRelease());
    for (const [key, value] of Object.entries(context || {})) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}
