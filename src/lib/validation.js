import { z } from 'zod';

// ============================================
// FACT Platform - Input Validation Schemas
// ============================================

// Basic validators
export const emailSchema = z.string()
  .email('Invalid email address')
  .min(5, 'Email too short')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim();

export const phoneSchema = z.string()
  .trim()
  .refine((value) => /^[\d\s()+.-]+$/.test(value), {
    message: 'Phone number contains invalid characters'
  })
  .refine((value) => {
    const plusCount = (value.match(/\+/g) || []).length;
    return plusCount === 0 || (plusCount === 1 && value.trim().startsWith('+'));
  }, {
    message: 'Use + only at the start of the phone number'
  })
  .refine((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }, {
    message: 'Phone number must contain 7 to 15 digits'
  })
  .transform((value) => {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, '');
    return trimmed.startsWith('+') ? `+${digits}` : digits;
  })
  .optional();

export const uuidSchema = z.string()
  .uuid('Invalid ID format');

export const urlSchema = z.string()
  .url('Invalid URL')
  .max(2048, 'URL too long')
  .optional()
  .or(z.literal(''));

// User profile validation
export const profileUpdateSchema = z.object({
  full_name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .trim(),
  phone: phoneSchema,
  location: z.string()
    .max(200, 'Location too long')
    .trim()
    .optional(),
  bio: z.string()
    .max(1000, 'Bio too long')
    .trim()
    .optional(),
  avatar_url: urlSchema,
});

// Coach profile validation
export const coachProfileSchema = z.object({
  hourly_rate: z.number()
    .min(10, 'Rate must be at least £10')
    .max(1000, 'Rate cannot exceed £1000')
    .positive(),
  services_offered: z.array(z.string())
    .min(1, 'Select at least one service')
    .max(10, 'Too many services selected'),
  age_groups: z.array(z.string())
    .min(1, 'Select at least one age group')
    .max(10, 'Too many age groups selected'),
});

// Booking validation (aligned with Netlify bookings function + BookingModal)
export const bookingSchema = z.object({
  coach_id: uuidSchema,
  service_type: z.string()
    .min(1, 'Please select a service type')
    .max(100, 'Service type is too long'),
  booking_date: z.string()
    .datetime('Invalid date/time')
    .refine((date) => new Date(date) > new Date(), {
      message: 'Booking date must be in the future'
    }),
  duration: z.number()
    .int()
    .min(30, 'Minimum session duration is 30 minutes')
    .max(240, 'Maximum session duration is 4 hours'),
  location_type: z.string()
    .min(2, 'Location type is required')
    .max(50, 'Location type too long'),
  location_address: z.string()
    .max(200, 'Location address too long')
    .optional(),
  client_notes: z.string()
    .max(500, 'Notes too long')
    .optional(),
  price: z.number()
    .min(0, 'Price cannot be negative'),
  admin_fee: z.number()
    .min(0, 'Admin fee cannot be negative'),
  total_price: z.number()
    .min(0, 'Total price cannot be negative'),
});

// Message validation
export const messageSchema = z.object({
  receiver_id: uuidSchema,
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long')
    .trim(),
});

// Review validation
export const reviewSchema = z.object({
  booking_id: uuidSchema,
  coach_id: uuidSchema,
  rating: z.number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  comment: z.string()
    .min(10, 'Review must be at least 10 characters')
    .max(1000, 'Review too long')
    .trim()
    .optional(),
});

// Availability validation
export const availabilitySchema = z.object({
  coach_id: uuidSchema,
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  location_override: z.string()
    .max(200, 'Location too long')
    .trim()
    .optional()
    .nullable(),
  notes: z.string()
    .max(500, 'Notes too long')
    .trim()
    .optional()
    .nullable(),
  is_available: z.boolean(),
}).refine((data) => new Date(data.end_date) > new Date(data.start_date), {
  message: 'End date must be after start date',
  path: ['end_date']
});

// Reschedule request validation
export const rescheduleSchema = z.object({
  booking_id: uuidSchema,
  proposed_date: z.string()
    .datetime()
    .refine((date) => new Date(date) > new Date(), {
      message: 'Proposed date must be in the future'
    }),
  reason: z.string()
    .max(500, 'Reason too long')
    .optional(),
});

// ============================================
// Sanitization Functions
// ============================================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 10000); // Max length safety
}

/**
 * Sanitize HTML by stripping all tags
 */
export function stripHtml(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize object by applying sanitization to all string fields
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Validate email format (stricter than basic regex)
 */
export function isValidEmail(email) {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate and sanitize user input
 */
export function validateAndSanitize(schema, data) {
  // First sanitize
  const sanitized = sanitizeObject(data);
  
  // Then validate
  return schema.parse(sanitized);
}

/**
 * Safe validation that returns result object instead of throwing
 */
export function safeValidate(schema, data) {
  const sanitized = sanitizeObject(data);
  const result = schema.safeParse(sanitized);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { 
      success: false, 
      errors: result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    };
  }
}

// ============================================
// Validation Error Formatter
// ============================================

/**
 * Format Zod errors for display
 */
export function formatValidationErrors(zodError) {
  const errors = {};
  
  zodError.errors.forEach(error => {
    const field = error.path.join('.');
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(error.message);
  });
  
  return errors;
}

/**
 * Get first error message for a field
 */
export function getFirstError(zodError, fieldName) {
  const error = zodError.errors.find(err => 
    err.path.join('.') === fieldName
  );
  return error?.message || null;
}

// ============================================
// Export all schemas for use throughout app
// ============================================

export const schemas = {
  email: emailSchema,
  phone: phoneSchema,
  uuid: uuidSchema,
  url: urlSchema,
  profileUpdate: profileUpdateSchema,
  coachProfile: coachProfileSchema,
  booking: bookingSchema,
  message: messageSchema,
  review: reviewSchema,
  availability: availabilitySchema,
  reschedule: rescheduleSchema,
};

export default schemas;
