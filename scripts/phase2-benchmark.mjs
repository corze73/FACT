import 'dotenv/config';
import crypto from 'crypto';
import { performance } from 'node:perf_hooks';
import { executeQueryOne, executeQuery } from '../netlify/functions/lib/db.js';
import { signAuthToken } from '../netlify/functions/lib/auth.js';
import { handler as usersHandler } from '../netlify/functions/users.js';
import { handler as bookingsHandler } from '../netlify/functions/bookings.js';

const measureFetch = async (url) => {
  const start = performance.now();
  const response = await fetch(url);
  const body = await response.text();
  const end = performance.now();

  return {
    status: response.status,
    duration_ms: Math.round(end - start),
    payload_kb: Number((Buffer.byteLength(body, 'utf8') / 1024).toFixed(2))
  };
};

const measureHandler = async (handler, event) => {
  const start = performance.now();
  const response = await handler(event);
  const end = performance.now();

  return {
    status: response.statusCode,
    duration_ms: Math.round(end - start),
    payload_kb: Number((Buffer.byteLength(response.body || '', 'utf8') / 1024).toFixed(2))
  };
};

const withRetry = async (fn, attempts = 6) => {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, i * 500));
    }
  }
  throw lastError;
};

const phase = process.argv[2] || 'run';

const guestFindCoaches = await measureFetch(
  'https://findacoachtoday.com/.netlify/functions/users?type=coach&limit=24&offset=0&include_total=1'
);

const adminProfile = await withRetry(() => executeQueryOne(
  "SELECT id, email FROM profiles WHERE user_type = 'admin' LIMIT 1",
  []
));

const adminToken = signAuthToken({
  sub: adminProfile.id,
  email: adminProfile.email,
  user_type: 'admin'
});

const adminHeaders = {
  authorization: `Bearer ${adminToken}`
};

const adminUsersPage1 = await withRetry(() => measureHandler(usersHandler, {
  httpMethod: 'GET',
  path: '/.netlify/functions/users',
  queryStringParameters: {
    type: 'all',
    limit: '20',
    offset: '0',
    include_total: '1',
    view: 'admin_list'
  },
  headers: adminHeaders
}));

const adminUsersPage2 = await withRetry(() => measureHandler(usersHandler, {
  httpMethod: 'GET',
  path: '/.netlify/functions/users',
  queryStringParameters: {
    type: 'all',
    limit: '20',
    offset: '20',
    include_total: '1',
    view: 'admin_list'
  },
  headers: adminHeaders
}));

const adminBookingsPage1 = await withRetry(() => measureHandler(bookingsHandler, {
  httpMethod: 'GET',
  path: '/.netlify/functions/bookings',
  queryStringParameters: {
    limit: '50',
    offset: '0',
    include_total: '1',
    orderBy: '-created_at',
    view: 'admin_list'
  },
  headers: adminHeaders
}));

const benchmarkUserId = crypto.randomUUID();
const benchmarkUserEmail = `perf-${benchmarkUserId.slice(0, 8)}@example.com`;

await withRetry(() => executeQuery(
  "INSERT INTO users (id, email, full_name, role, created_at, updated_at) VALUES ($1, $2, $3, 'user', NOW(), NOW())",
  [benchmarkUserId, benchmarkUserEmail, 'Perf Temp User']
));

await withRetry(() => executeQuery(
  "INSERT INTO profiles (id, email, full_name, user_type, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, 'client', 'user', true, NOW(), NOW())",
  [benchmarkUserId, benchmarkUserEmail, 'Perf Temp User']
));

const deleteUserServer = await withRetry(() => measureHandler(usersHandler, {
  httpMethod: 'DELETE',
  path: `/.netlify/functions/users/${benchmarkUserId}`,
  headers: adminHeaders,
  body: JSON.stringify({ reason: `phase2 ${phase}`, hard: false })
}));

const result = {
  phase,
  timestamp: new Date().toISOString(),
  guest_find_coaches: guestFindCoaches,
  admin_users_page1: adminUsersPage1,
  admin_users_page2: adminUsersPage2,
  admin_bookings_page1: adminBookingsPage1,
  delete_user_server: deleteUserServer
};

console.log(JSON.stringify(result, null, 2));
