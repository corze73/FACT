/* eslint-env node */

/**
 * Standardized error handling for Netlify Functions
 * Provides consistent error responses and logging
 */

/**
 * Error types for better categorization
 */
export const ErrorTypes = {
  VALIDATION: 'ValidationError',
  NOT_FOUND: 'NotFoundError',
  UNAUTHORIZED: 'UnauthorizedError',
  FORBIDDEN: 'ForbiddenError',
  CONFLICT: 'ConflictError',
  RATE_LIMIT: 'RateLimitError',
  DATABASE: 'DatabaseError',
  EXTERNAL: 'ExternalServiceError',
  INTERNAL: 'InternalServerError',
};

/**
 * Map error types to HTTP status codes
 */
const ErrorStatusCodes = {
  [ErrorTypes.VALIDATION]: 400,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.UNAUTHORIZED]: 401,
  [ErrorTypes.FORBIDDEN]: 403,
  [ErrorTypes.CONFLICT]: 409,
  [ErrorTypes.RATE_LIMIT]: 429,
  [ErrorTypes.DATABASE]: 500,
  [ErrorTypes.EXTERNAL]: 502,
  [ErrorTypes.INTERNAL]: 500,
};

/**
 * Custom error class with type and context
 */
export class AppError extends Error {
  constructor(type, message, context = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = ErrorStatusCodes[type] || 500;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Create error response object
 */
export function createErrorResponse(error, headers = {}) {
  // Handle AppError instances
  if (error instanceof AppError) {
    const response = {
      error: error.type,
      message: error.message,
      timestamp: error.timestamp,
    };

    // Include context in development
    if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
      response.context = error.context;
      response.stack = error.stack;
    }

    return {
      statusCode: error.statusCode,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    };
  }

  // Handle database errors
  if (error.code) {
    const dbError = mapDatabaseError(error);
    return createErrorResponse(dbError, headers);
  }

  // Generic error fallback
  const response = {
    error: ErrorTypes.INTERNAL,
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };

  // Include details in development
  if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
    response.details = error.message;
    response.stack = error.stack;
  }

  console.error('Unhandled error:', error);

  return {
    statusCode: 500,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Map common Postgres errors to AppError
 */
function mapDatabaseError(error) {
  const code = error.code;
  const message = error.message;

  // Unique violation
  if (code === '23505') {
    return new AppError(
      ErrorTypes.CONFLICT,
      'A record with this information already exists',
      { detail: error.detail }
    );
  }

  // Foreign key violation
  if (code === '23503') {
    return new AppError(
      ErrorTypes.VALIDATION,
      'Referenced record does not exist',
      { detail: error.detail }
    );
  }

  // Not null violation
  if (code === '23502') {
    return new AppError(
      ErrorTypes.VALIDATION,
      'Required field is missing',
      { column: error.column }
    );
  }

  // Check violation
  if (code === '23514') {
    return new AppError(
      ErrorTypes.VALIDATION,
      'Data does not meet validation requirements',
      { detail: error.detail }
    );
  }

  // Connection errors
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    return new AppError(
      ErrorTypes.DATABASE,
      'Database connection failed',
      { code }
    );
  }

  // Generic database error
  return new AppError(
    ErrorTypes.DATABASE,
    'A database error occurred',
    { code, message: process.env.NODE_ENV === 'development' ? message : undefined }
  );
}

/**
 * Success response helper
 */
export function createSuccessResponse(data, headers = {}, statusCode = 200) {
  return {
    statusCode,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Validation helper
 */
export function validateRequired(data, fields) {
  const missing = fields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new AppError(
      ErrorTypes.VALIDATION,
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
}

/**
 * UUID validation
 */
export function validateUUID(value, fieldName = 'id') {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(value)) {
    throw new AppError(
      ErrorTypes.VALIDATION,
      `Invalid ${fieldName} format`,
      { field: fieldName, value }
    );
  }
}

/**
 * Try-catch wrapper for handlers
 */
export function withErrorHandling(handler) {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      // Get headers from the event if available
      const headers = typeof handler.getHeaders === 'function' 
        ? handler.getHeaders(event)
        : { 'Content-Type': 'application/json' };
      
      return createErrorResponse(error, headers);
    }
  };
}
