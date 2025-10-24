import dotenv from 'dotenv';
dotenv.config();

import { handler } from './netlify/functions/users.js';

const event = {
  httpMethod: 'POST',
  path: '/.netlify/functions/users',
  isBase64Encoded: false,
  body: JSON.stringify({ email: 'debug@example.com', full_name: 'Debug User' })
};

const ctx = {};

try {
  const res = await handler(event, ctx);
  console.log('Status:', res.statusCode);
  console.log('Body:', res.body);
} catch (e) {
  console.error('Invocation error:', e);
}
