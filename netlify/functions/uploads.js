/* eslint-env node */
import Busboy from 'busboy';
import { Buffer } from 'buffer';
import { getAuthContext } from './lib/auth.js';
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js';
import { withFunctionObservability, captureFunctionError } from './lib/observability.js';
import { uploadBuffer } from './lib/storage.js';

const getAllowedOrigin = (requestOrigin) => {
  const allowedOrigins = [
    'https://findacoachtoday.com',
    'https://www.findacoachtoday.com',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
  if (process.env.NETLIFY_DEV === 'true') return requestOrigin || '*';
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
};

const getHeaders = (event) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(event.headers?.origin),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
});

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const parseMultipartBody = (event) => new Promise((resolve, reject) => {
  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    reject(new Error('Content-Type must be multipart/form-data'));
    return;
  }

  const busboy = Busboy({
    headers: { 'content-type': contentType },
    limits: { fileSize: MAX_FILE_BYTES, files: 1 }
  });

  const fields = {};
  let filePart = null;

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (name, file, info) => {
    const chunks = [];
    let totalBytes = 0;

    file.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_FILE_BYTES) {
        file.unpipe();
        file.resume();
        reject(new Error('File exceeds 10MB size limit'));
        return;
      }
      chunks.push(chunk);
    });

    file.on('limit', () => {
      reject(new Error('File exceeds 10MB size limit'));
    });

    file.on('end', () => {
      filePart = {
        fieldName: name,
        fileName: info.filename,
        mimeType: info.mimeType,
        encoding: info.encoding,
        buffer: Buffer.concat(chunks),
        size: totalBytes
      };
    });
  });

  busboy.on('error', (err) => reject(err));

  busboy.on('finish', () => {
    if (!filePart || !filePart.buffer?.length) {
      reject(new Error('No file uploaded'));
      return;
    }
    resolve({ fields, file: filePart });
  });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf-8');

  busboy.end(rawBody);
});

const rawHandler = async (event) => {
  const headers = getHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const rateLimitResponse = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await getAuthContext(event);
    if (!auth.userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    if (!(auth.userType === 'coach' || auth.isAdmin)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Coach or admin access required' }) };
    }

    const { file } = await parseMultipartBody(event);

    if (!ALLOWED_MIME.has(String(file.mimeType || '').toLowerCase())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unsupported file type. Allowed: PDF, JPG, JPEG, PNG' })
      };
    }

    const uploaded = await uploadBuffer({
      buffer: file.buffer,
      contentType: file.mimeType,
      fileName: file.fileName,
      prefix: `coach-compliance/${auth.userId}`
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: { url: uploaded.url } })
    };
  } catch (error) {
    captureFunctionError(error, {
      route: 'uploads',
      method: event.httpMethod,
      path: event.path
    });

    const status = /size limit|No file uploaded|multipart\/form-data|Unsupported file type/i.test(error.message)
      ? 400
      : 500;

    return {
      statusCode: status,
      headers,
      body: JSON.stringify({ error: status === 400 ? error.message : 'Upload failed' })
    };
  }
};

export const handler = withFunctionObservability('uploads', rawHandler);
