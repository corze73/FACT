# 🔒 Security Features - Integration Guide

## What's Been Added

### 1. Input Validation (Zod) ✅
Location: `src/lib/validation.js`

### 2. Security Headers ✅
Location: `vite-plugin-security-headers.js`

### 3. Client-Side Rate Limiting ✅
Location: `src/lib/rateLimiter.js`

---

## How to Use Input Validation

### Example 1: Validate User Profile Update

```javascript
import { validateAndSanitize, profileUpdateSchema } from '@/lib/validation';

async function updateProfile(data) {
  try {
    // Validate and sanitize input
    const validData = validateAndSanitize(profileUpdateSchema, data);
    
    // Safe to use validData now
    await User.updateMyUserData(validData);
    
  } catch (error) {
    if (error.name === 'ZodError') {
      // Handle validation errors
      console.error('Validation failed:', error.errors);
      alert('Please check your input: ' + error.errors[0].message);
    }
  }
}
```

### Example 2: Validate Booking

```javascript
import { safeValidate, bookingSchema } from '@/lib/validation';

function handleBooking(formData) {
  const result = safeValidate(bookingSchema, formData);
  
  if (!result.success) {
    // Show validation errors to user
    result.errors.forEach(err => {
      console.error(`${err.field}: ${err.message}`);
    });
    return;
  }
  
  // Proceed with validated data
  createBooking(result.data);
}
```

### Example 3: Real-time Form Validation

```javascript
import { schemas } from '@/lib/validation';

function validateEmail(email) {
  try {
    schemas.email.parse(email);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      message: error.errors[0].message 
    };
  }
}

// In your component:
const emailValidation = validateEmail(userInput);
if (!emailValidation.valid) {
  setEmailError(emailValidation.message);
}
```

---

## How to Use Rate Limiting

### Example 1: Protect Login Attempts

```javascript
import { checkRateLimit } from '@/lib/rateLimiter';

async function handleLogin(email, password) {
  try {
    // Check rate limit before attempting login
    const rateStatus = checkRateLimit('login');
    console.log(`Remaining attempts: ${rateStatus.remaining}`);
    
    // Proceed with login
    await User.login(email, password);
    
  } catch (error) {
    if (error.message.includes('Too many requests')) {
      alert(error.message);
    }
  }
}
```

### Example 2: Protect API Calls

```javascript
import { rateLimitedFetch } from '@/lib/rateLimiter';

async function sendMessage(receiverId, content) {
  try {
    // This will automatically rate limit
    const response = await rateLimitedFetch(
      '/api/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, content })
      },
      'message' // endpoint name for rate limiting
    );
    
    return response.json();
    
  } catch (error) {
    if (error.message.includes('rate limit')) {
      showNotification('Please wait before sending another message', 'warning');
    }
  }
}
```

### Example 3: Show Rate Limit Status

```javascript
import { getRateLimitStatus } from '@/lib/rateLimiter';

function BookingButton() {
  const status = getRateLimitStatus('booking');
  
  return (
    <div>
      <button 
        onClick={createBooking}
        disabled={status.remaining === 0}
      >
        Book Session
      </button>
      <small>
        {status.remaining} bookings remaining (resets at {status.resetTime.toLocaleTimeString()})
      </small>
    </div>
  );
}
```

---

## Integrating Into Existing Code

### Update UserProfile.jsx

```javascript
import { validateAndSanitize, profileUpdateSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rateLimiter';

export default function UserProfile() {
  // ... existing code ...

  const handleSave = async () => {
    try {
      // Check rate limit
      checkRateLimit('profile');
      
      // Validate input
      const validData = validateAndSanitize(profileUpdateSchema, formData);
      
      // Save
      setIsSaving(true);
      await User.updateMyUserData(validData);
      
      showNotification('Profile updated successfully!', 'success');
      
    } catch (error) {
      if (error.name === 'ZodError') {
        showNotification('Please check your input', 'error');
      } else if (error.message.includes('rate limit')) {
        showNotification(error.message, 'warning');
      } else {
        showNotification('Failed to update profile', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  // ... rest of component ...
}
```

### Update BookingModal.jsx

```javascript
import { safeValidate, bookingSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rateLimiter';

export default function BookingModal({ coachId, onClose }) {
  // ... existing code ...

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Check rate limit
      checkRateLimit('booking');
      
      // Prepare data
      const bookingData = {
        coach_id: coachId,
        service_type: selectedService,
        booking_date: selectedDate.toISOString(),
        duration_minutes: duration,
        total_amount: totalAmount,
        notes: notes
      };
      
      // Validate
      const validation = safeValidate(bookingSchema, bookingData);
      
      if (!validation.success) {
        const errorMsg = validation.errors.map(e => e.message).join(', ');
        setError(errorMsg);
        return;
      }
      
      // Create booking with validated data
      await Booking.create(validation.data);
      onClose();
      
    } catch (error) {
      setError(error.message);
    }
  };
  
  // ... rest of component ...
}
```

### Update Messages/Conversation

```javascript
import { validateAndSanitize, messageSchema } from '@/lib/validation';
import { rateLimitedFetch, getRateLimitStatus } from '@/lib/rateLimiter';

export default function Conversation() {
  const [rateLimitStatus, setRateLimitStatus] = useState(null);
  
  useEffect(() => {
    // Update rate limit status every second
    const interval = setInterval(() => {
      setRateLimitStatus(getRateLimitStatus('message'));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (content) => {
    try {
      // Validate message
      const validData = validateAndSanitize(messageSchema, {
        receiver_id: otherUserId,
        content: content
      });
      
      // Send with rate limiting
      await Message.create(validData);
      
      // Update UI
      setRateLimitStatus(getRateLimitStatus('message'));
      
    } catch (error) {
      if (error.name === 'ZodError') {
        showNotification('Message is invalid', 'error');
      } else {
        showNotification(error.message, 'error');
      }
    }
  };
  
  // Show warning when approaching limit
  if (rateLimitStatus && rateLimitStatus.remaining < 5) {
    return (
      <div className="warning">
        ⚠️ You have {rateLimitStatus.remaining} messages remaining before rate limit
      </div>
    );
  }
  
  // ... rest of component ...
}
```

---

## Security Headers - Already Active!

The security headers are automatically applied to all pages. You can verify by:

1. Open browser DevTools
2. Go to Network tab
3. Refresh page
4. Click on any request
5. Check Response Headers

You should see:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

---

## Testing Security Features

### Test Input Validation

```javascript
import { validateAndSanitize, profileUpdateSchema } from '@/lib/validation';

// Test 1: Valid input
const valid = validateAndSanitize(profileUpdateSchema, {
  full_name: 'John Doe',
  phone: '+442012345678',
  bio: 'Professional coach'
});
console.log('✅ Valid:', valid);

// Test 2: Invalid input (should throw)
try {
  validateAndSanitize(profileUpdateSchema, {
    full_name: 'J', // Too short
    phone: 'invalid',
    bio: 'x'.repeat(2000) // Too long
  });
} catch (error) {
  console.log('❌ Caught validation error:', error.errors);
}

// Test 3: XSS attempt (should be sanitized)
const dangerous = validateAndSanitize(profileUpdateSchema, {
  full_name: '<script>alert("xss")</script>John',
  bio: 'Coach<img src=x onerror=alert(1)>'
});
console.log('🛡️ Sanitized:', dangerous);
// Output should have < and > removed
```

### Test Rate Limiting

```javascript
import { checkRateLimit, getRateLimitStatus } from '@/lib/rateLimiter';

// Test: Exceed rate limit
async function testRateLimit() {
  try {
    for (let i = 0; i < 10; i++) {
      const status = checkRateLimit('login');
      console.log(`Attempt ${i + 1}: ${status.remaining} remaining`);
    }
  } catch (error) {
    console.log('❌ Rate limit exceeded:', error.message);
  }
  
  // Check status
  const status = getRateLimitStatus('login');
  console.log('Status:', status);
}

testRateLimit();
```

---

## Common Validation Schemas

All available in `src/lib/validation.js`:

- `emailSchema` - Email validation
- `phoneSchema` - Phone number validation
- `uuidSchema` - UUID validation
- `urlSchema` - URL validation
- `profileUpdateSchema` - User profile
- `coachProfileSchema` - Coach-specific fields
- `bookingSchema` - Booking creation
- `messageSchema` - Messages
- `reviewSchema` - Reviews
- `availabilitySchema` - Coach availability
- `rescheduleSchema` - Reschedule requests

---

## Rate Limit Configurations

Current limits (configurable in `src/lib/rateLimiter.js`):

- **Login**: 5 attempts per 15 minutes
- **Bookings**: 10 per hour
- **Messages**: 50 per 15 minutes
- **Profile updates**: 20 per 15 minutes
- **Default**: 100 per 15 minutes

---

## Next Steps

1. ✅ **Input validation** - Added
2. ✅ **Security headers** - Active
3. ✅ **Rate limiting** - Client-side protection
4. ⏭️ **Integrate into components** - Update existing forms
5. ⏭️ **Server-side rate limiting** - For backend API (Phase 2)
6. ⏭️ **Penetration testing** - Professional security audit

---

## Questions?

- Check `SECURITY_IMPLEMENTATION_PLAN.md` for full roadmap
- Review `SECURITY_AUDIT_REPORT.md` for vulnerabilities
- See `SECURITY_QUICKSTART.md` for daily practices
