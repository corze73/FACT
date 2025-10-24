/* eslint-env node */

export async function handler() {
  try {
    const hasDb = !!process.env.DATABASE_URL;
    const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
    const hasPublishable = !!(process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
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
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'health check failed', message: err.message })
    };
  }
}
