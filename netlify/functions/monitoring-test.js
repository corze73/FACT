/* eslint-env node */
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';

const rawHandler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const query = event.queryStringParameters || {};
  const shouldThrow = query.throw === '1' || query.test === '1';
  if (shouldThrow) {
    const err = new Error('Phase 4 monitoring test error');
    captureFunctionError(err, { route: 'monitoring-test', reason: 'manual-test-trigger' });
    throw err;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      message: 'Use ?throw=1 to trigger a test error'
    })
  };
};

export const handler = withFunctionObservability('monitoring-test', rawHandler);
