/**
 * Client-side Rate Limiter
 * Prevents abuse by limiting API calls from the browser
 * Note: This is NOT a replacement for server-side rate limiting
 */

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.limits = {
      // API endpoints limits (requests per time window)
      login: { max: 5, window: 15 * 60 * 1000 }, // 5 per 15 min
      booking: { max: 10, window: 60 * 60 * 1000 }, // 10 per hour
      message: { max: 50, window: 15 * 60 * 1000 }, // 50 per 15 min
      profile: { max: 20, window: 15 * 60 * 1000 }, // 20 per 15 min
      default: { max: 100, window: 15 * 60 * 1000 }, // 100 per 15 min
    };
  }

  /**
   * Check if request is allowed
   */
  checkLimit(endpoint, customLimit = null) {
    const limit = customLimit || this.limits[endpoint] || this.limits.default;
    const now = Date.now();
    const key = endpoint;

    // Get existing requests for this endpoint
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const requests = this.requests.get(key);

    // Remove old requests outside the time window
    const validRequests = requests.filter(
      timestamp => now - timestamp < limit.window
    );

    // Check if limit exceeded
    if (validRequests.length >= limit.max) {
      const oldestRequest = Math.min(...validRequests);
      const resetTime = new Date(oldestRequest + limit.window);
      return {
        allowed: false,
        resetTime,
        remaining: 0,
        limit: limit.max
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      allowed: true,
      remaining: limit.max - validRequests.length,
      limit: limit.max,
      resetTime: new Date(now + limit.window)
    };
  }

  /**
   * Reset limits for an endpoint
   */
  reset(endpoint) {
    this.requests.delete(endpoint);
  }

  /**
   * Clear all limits
   */
  clearAll() {
    this.requests.clear();
  }

  /**
   * Get current status for an endpoint
   */
  getStatus(endpoint) {
    const limit = this.limits[endpoint] || this.limits.default;
    const now = Date.now();
    const key = endpoint;

    if (!this.requests.has(key)) {
      return {
        used: 0,
        remaining: limit.max,
        limit: limit.max,
        resetTime: new Date(now + limit.window)
      };
    }

    const requests = this.requests.get(key);
    const validRequests = requests.filter(
      timestamp => now - timestamp < limit.window
    );

    return {
      used: validRequests.length,
      remaining: limit.max - validRequests.length,
      limit: limit.max,
      resetTime: validRequests.length > 0 
        ? new Date(Math.min(...validRequests) + limit.window)
        : new Date(now + limit.window)
    };
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit decorator for async functions
 */
export function rateLimit(endpoint, customLimit = null) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const result = rateLimiter.checkLimit(endpoint, customLimit);

      if (!result.allowed) {
        const error = new Error(`Rate limit exceeded. Try again at ${result.resetTime.toLocaleTimeString()}`);
        error.name = 'RateLimitError';
        error.resetTime = result.resetTime;
        error.endpoint = endpoint;
        throw error;
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Simple rate limit check before API call
 */
export function checkRateLimit(endpoint, customLimit = null) {
  const result = rateLimiter.checkLimit(endpoint, customLimit);
  
  if (!result.allowed) {
    throw new Error(
      `Too many requests. Please wait until ${result.resetTime.toLocaleTimeString()}`
    );
  }
  
  return result;
}

/**
 * Wrapper for fetch with rate limiting
 */
export async function rateLimitedFetch(url, options = {}, endpoint = 'default') {
  // Check rate limit before making request
  checkRateLimit(endpoint);

  // Make the request
  const response = await fetch(url, options);

  // Handle rate limit responses from server
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const resetTime = retryAfter 
      ? new Date(Date.now() + parseInt(retryAfter) * 1000)
      : new Date(Date.now() + 60000);

    throw new Error(
      `Server rate limit exceeded. Try again at ${resetTime.toLocaleTimeString()}`
    );
  }

  return response;
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(endpoint) {
  return rateLimiter.getStatus(endpoint);
}

/**
 * Reset rate limits
 */
export function resetRateLimit(endpoint) {
  if (endpoint) {
    rateLimiter.reset(endpoint);
  } else {
    rateLimiter.clearAll();
  }
}

export default rateLimiter;
