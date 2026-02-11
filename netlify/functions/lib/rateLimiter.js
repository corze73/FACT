/* eslint-env node */

/**
 * Simple in-memory rate limiter for Netlify functions
 * Prevents abuse by tracking request counts per IP/identifier
 * 
 * NOTE: This is in-memory and will reset on cold starts.
 * For production, consider Redis or similar distributed cache.
 */

const requestCounts = new Map();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > data.windowMs) {
      requestCounts.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Rate limiter configuration
 */
export const RATE_LIMITS = {
  // Default: 100 requests per 15 minutes
  default: { max: 100, windowMs: 15 * 60 * 1000 },
  
  // Authentication endpoints: allow more generous attempts per 15 minutes
  // (still protects against brute-force, but avoids blocking normal usage)
  auth: { max: 30, windowMs: 15 * 60 * 1000 },
  
  // Mutations (POST/PUT/DELETE): 30 per minute
  mutation: { max: 30, windowMs: 60 * 1000 },
  
  // Read operations: 200 per minute
  read: { max: 200, windowMs: 60 * 1000 }
};

/**
 * Check if request is rate limited
 * @param {string} identifier - Usually IP address or user ID
 * @param {Object} limit - Rate limit config { max, windowMs }
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(identifier, limit = RATE_LIMITS.default) {
  const now = Date.now();
  const key = `${identifier}:${limit.windowMs}`;
  
  let data = requestCounts.get(key);
  
  // Initialize or reset window if expired
  if (!data || now - data.windowStart > limit.windowMs) {
    data = {
      count: 0,
      windowStart: now,
      windowMs: limit.windowMs
    };
    requestCounts.set(key, data);
  }
  
  // Increment count
  data.count++;
  
  const allowed = data.count <= limit.max;
  const remaining = Math.max(0, limit.max - data.count);
  const resetAt = data.windowStart + limit.windowMs;
  
  return { allowed, remaining, resetAt, limit: limit.max };
}

/**
 * Get identifier from Netlify event (IP or user ID)
 */
export function getIdentifier(event) {
  // Prefer user ID if available (from headers or JWT)
  const userId = event.headers?.['x-user-id'] || event.headers?.['X-User-Id'];
  if (userId) return `user:${userId}`;
  
  // Fallback to IP address
  const ip = 
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['x-real-ip'] ||
    event.headers?.['client-ip'] ||
    'unknown';
  
  return `ip:${ip}`;
}

/**
 * Middleware to apply rate limiting to Netlify function
 * Returns 429 response if rate limit exceeded
 * 
 * @param {Object} event - Netlify event
 * @param {Object} headers - Response headers
 * @param {Object} limit - Rate limit config
 * @returns {Object|null} - 429 response if limited, null if allowed
 */
export function rateLimitMiddleware(event, headers, limit = RATE_LIMITS.default) {
  const identifier = getIdentifier(event);
  const result = checkRateLimit(identifier, limit);
  
  // Add rate limit headers
  const rateLimitHeaders = {
    ...headers,
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString()
  };
  
  if (!result.allowed) {
    return {
      statusCode: 429,
      headers: rateLimitHeaders,
      body: JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        resetAt: new Date(result.resetAt).toISOString()
      })
    };
  }
  
  return null; // Request allowed, headers can be added to response
}

/**
 * Helper to get rate limit based on HTTP method
 */
export function getLimitByMethod(httpMethod) {
  if (httpMethod === 'GET' || httpMethod === 'HEAD') {
    return RATE_LIMITS.read;
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)) {
    return RATE_LIMITS.mutation;
  }
  return RATE_LIMITS.default;
}
