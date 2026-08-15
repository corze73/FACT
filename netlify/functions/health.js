/* eslint-env node */
import { executeQueryOne } from './lib/db.js';
import { withFunctionObservability, captureFunctionError, getBuildMeta } from './lib/observability.js';

const rawHandler = async () => {
  try {
    const hasDb = !!process.env.DATABASE_URL;
    const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
    const hasPublishable = !!(process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY);
    const stripeConfigured = hasStripeSecret && hasWebhook && hasPublishable;
    const hasSmtpHost = !!process.env.SMTP_HOST;
    const hasSmtpUser = !!process.env.SMTP_USER;
    const hasSmtpPass = !!process.env.SMTP_PASS;
    const smtpConfigured = hasSmtpHost && hasSmtpUser && hasSmtpPass;

    // Derive mode from key prefix so testers can verify test vs live at a glance
    const _key = process.env.STRIPE_SECRET_KEY || '';
    const stripeMode = _key.startsWith('sk_live_') ? 'live'
      : _key.startsWith('sk_test_') ? 'test'
      : 'unknown';
    const expectedMode = (process.env.STRIPE_MODE || '').toLowerCase();
    const stripeModeMismatch = !!(expectedMode && expectedMode !== stripeMode);
    const build = getBuildMeta();

    let db = { configured: hasDb, connected: false };
    if (hasDb) {
      try {
        const row = await executeQueryOne('SELECT 1 AS ok', []);
        db = {
          configured: true,
          connected: row?.ok === 1
        };
      } catch (dbError) {
        db = {
          configured: true,
          connected: false,
          error: dbError.message
        };
      }
    }

    const status = db.connected && stripeConfigured && !stripeModeMismatch && smtpConfigured
      ? 'ok'
      : 'degraded';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        timestamp: new Date().toISOString(),
        app: {
          name: 'fact',
          build: build.release,
          environment: build.environment
        },
        db,
        stripe: {
          configured: stripeConfigured,
          mode: stripeMode,
          mode_mismatch: stripeModeMismatch
        },
        email: {
          configured: smtpConfigured,
          host: hasSmtpHost ? 'present' : 'missing',
          user: hasSmtpUser ? 'present' : 'missing',
          password: hasSmtpPass ? 'present' : 'missing'
        },
        env: {
          database_url: hasDb ? 'present' : 'missing',
          stripe_secret_key: hasStripeSecret ? 'present' : 'missing',
          stripe_webhook_secret: hasWebhook ? 'present' : 'missing',
          publishable_key: hasPublishable ? 'present' : 'missing',
          smtp_host: hasSmtpHost ? 'present' : 'missing',
          smtp_user: hasSmtpUser ? 'present' : 'missing',
          smtp_pass: hasSmtpPass ? 'present' : 'missing'
        },
        runtime: {
          node: process.version
        }
      })
    };
  } catch (err) {
    captureFunctionError(err, { route: 'health' });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'health check failed', message: err.message })
    };
  }
};

export const handler = withFunctionObservability('health', rawHandler);
