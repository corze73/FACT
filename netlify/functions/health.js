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

    const status = db.connected ? 'ok' : 'degraded';

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
          configured: stripeConfigured
        },
        env: {
          database_url: hasDb ? 'present' : 'missing',
          stripe_secret_key: hasStripeSecret ? 'present' : 'missing',
          stripe_webhook_secret: hasWebhook ? 'present' : 'missing',
          publishable_key: hasPublishable ? 'present' : 'missing'
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
