# 🚀 Phase 2: Netlify Serverless Backend

**Platform:** Netlify (Serverless Functions)  
**Status:** Ready to Implement  
**Time Estimate:** 1-2 days  
**Priority:** HIGH (Fixes CRITICAL security issue)

---

## 🎯 What We Need to Fix

**Current Problem:**
```javascript
// ❌ CRITICAL: Database credentials exposed in client code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Anyone can:**
- View your database connection string in browser DevTools
- Extract your database credentials
- Connect directly to your database
- Bypass all client-side validation

---

## ✅ Solution: Netlify Serverless Functions

Netlify provides **serverless functions** out of the box! No separate server needed.

**How it works:**
```
Client (Browser)
    ↓ API request
Netlify Function (/.netlify/functions/api)
    ↓ Database credentials (server-side only)
Neon Database
    ↓ Response
Client
```

**Benefits:**
- ✅ Database credentials stay server-side
- ✅ No server to manage
- ✅ Automatic scaling
- ✅ Built into Netlify (no extra cost)
- ✅ Easy to deploy

---

## 📁 Project Structure

```
/Users/corycharles/FACT/
├── src/                          # Frontend (existing)
│   ├── pages/
│   ├── components/
│   └── api/
│       └── supabaseClient.js     # Will be updated
│
├── netlify/                      # NEW: Serverless functions
│   └── functions/
│       ├── users.js              # User operations
│       ├── bookings.js           # Booking operations
│       ├── messages.js           # Message operations
│       ├── coaches.js            # Coach operations
│       └── lib/
│           ├── db.js             # Database connection (server-side)
│           └── auth.js           # JWT validation
│
├── netlify.toml                  # Netlify configuration
└── .env                          # Server-side secrets (not committed)
```

---

## 🔧 Implementation Steps

### Step 1: Create Netlify Functions Directory

```bash
mkdir -p netlify/functions/lib
```

### Step 2: Configure Netlify

**File:** `netlify.toml` (create in project root)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[dev]
  command = "npm run dev"
  port = 5173
  targetPort = 5173
  framework = "vite"
```

### Step 3: Create Database Connection (Server-Side)

**File:** `netlify/functions/lib/db.js`

```javascript
import { neon } from '@neondatabase/serverless';

// Server-side only - never sent to client
const sql = neon(process.env.DATABASE_URL);

export async function query(text, params) {
  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

export default { query };
```

### Step 4: Create User API Function

**File:** `netlify/functions/users.js`

```javascript
import { query } from './lib/db.js';

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { path, httpMethod, body } = event;
    const userId = path.split('/').pop();

    switch (httpMethod) {
      case 'GET':
        if (userId && userId !== 'users') {
          // Get single user
          const result = await query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
          );
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result[0])
          };
        } else {
          // Get all users (admin only - add auth check)
          const result = await query('SELECT * FROM users');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
          };
        }

      case 'POST':
        // Create user
        const userData = JSON.parse(body);
        const result = await query(
          `INSERT INTO users (email, full_name, role) 
           VALUES ($1, $2, $3) 
           RETURNING *`,
          [userData.email, userData.full_name, userData.role || 'client']
        );
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(result[0])
        };

      case 'PUT':
        // Update user
        const updateData = JSON.parse(body);
        const updateResult = await query(
          `UPDATE users 
           SET full_name = $1, phone = $2, location = $3, bio = $4 
           WHERE id = $5 
           RETURNING *`,
          [
            updateData.full_name,
            updateData.phone,
            updateData.location,
            updateData.bio,
            userId
          ]
        );
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updateResult[0])
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}
```

### Step 5: Create Booking API Function

**File:** `netlify/functions/bookings.js`

```javascript
import { query } from './lib/db.js';

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, body } = event;

    switch (httpMethod) {
      case 'GET':
        // Get all bookings (with filters from query params)
        const result = await query('SELECT * FROM bookings ORDER BY created_date DESC');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result)
        };

      case 'POST':
        // Create booking with validation
        const bookingData = JSON.parse(body);
        
        // Server-side validation
        if (!bookingData.coach_id || !bookingData.client_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields' })
          };
        }

        const newBooking = await query(
          `INSERT INTO bookings 
           (coach_id, client_id, service_type, session_date, session_time, 
            duration, location_type, location_address, client_notes, 
            price, admin_fee, total_price, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            bookingData.coach_id,
            bookingData.client_id,
            bookingData.service_type,
            bookingData.session_date,
            bookingData.session_time,
            bookingData.duration,
            bookingData.location_type,
            bookingData.location_address,
            bookingData.client_notes,
            bookingData.price,
            bookingData.admin_fee,
            bookingData.total_price,
            'pending'
          ]
        );

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newBooking[0])
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}
```

### Step 6: Update Frontend API Client

**File:** `src/api/supabaseClient.js` → Rename to `src/api/apiClient.js`

```javascript
// NEW: Use Netlify functions instead of direct Supabase
const API_BASE = '/.netlify/functions';

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  // User operations
  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Booking operations
  async createBooking(data) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getBookings(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/bookings?${params}`);
  }

  // Message operations
  async sendMessage(data) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMessages(bookingId) {
    return this.request(`/messages/${bookingId}`);
  }
}

export const apiClient = new APIClient();
export default apiClient;
```

### Step 7: Update Environment Variables

**In Netlify Dashboard:**
1. Go to Site Settings → Environment Variables
2. Add:
   - `DATABASE_URL` = `REDACTED_NEON_URL
   - `JWT_SECRET` = `your-secure-random-string`

**Local Development (`.env`):**
```bash
DATABASE_URL=REDACTED_NEON_URL
JWT_SECRET=your-local-dev-secret
```

**Important:** Add `.env` to `.gitignore` ✅

---

## 📦 Required Dependencies

```bash
# Install Neon serverless driver for Netlify functions
npm install @neondatabase/serverless

# Install Netlify CLI for local testing
npm install -D netlify-cli
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "dev": "netlify dev",
    "build": "vite build",
    "preview": "netlify serve"
  }
}
```

---

## 🧪 Testing Locally

```bash
# Start Netlify dev server (includes functions)
npm run dev

# This starts:
# - Vite dev server (frontend)
# - Netlify functions server (backend)
# - Automatic proxying between them
```

**Test a function:**
```bash
curl http://localhost:8888/.netlify/functions/users
```

---

## 🚀 Deployment to Netlify

### Option 1: Automatic (Recommended)

1. Push code to GitHub
2. Netlify auto-deploys on push
3. Functions are automatically deployed

### Option 2: Manual

```bash
# Build and deploy
npm run build
netlify deploy --prod
```

---

## 🔒 Security Benefits

### Before (Client-Side):
```javascript
// ❌ Exposed to everyone
const db = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_KEY);
```

**Anyone can:**
- See database URL in DevTools
- Connect directly to database
- Bypass validation

### After (Serverless Functions):
```javascript
// ✅ Hidden in Netlify function
const sql = neon(process.env.DATABASE_URL); // Server-side only
```

**Security improvements:**
- ✅ Database credentials never sent to client
- ✅ Server-side validation enforced
- ✅ Rate limiting easier to implement
- ✅ Audit logging possible
- ✅ Direct database access blocked

---

## 📊 Cost Analysis

**Netlify Pricing:**
- ✅ **Free Tier:** 125,000 function invocations/month
- ✅ **Pro Tier ($19/mo):** 2 million invocations/month

**For your platform:**
- Average user session: ~50 API calls
- Free tier supports: 2,500 user sessions/month
- Pro tier supports: 40,000 user sessions/month

**Recommendation:** Start on free tier, upgrade when needed! 💰

---

## 🎯 Migration Strategy

### Phase 2A: Setup (30 minutes)
1. Create `netlify/functions` directory
2. Add `netlify.toml` configuration
3. Install `@neondatabase/serverless`
4. Add environment variables to Netlify

### Phase 2B: Build Functions (2-3 hours)
1. Create `users.js` function
2. Create `bookings.js` function
3. Create `messages.js` function
4. Create `coaches.js` function

### Phase 2C: Update Frontend (1-2 hours)
1. Replace `supabaseClient.js` with `apiClient.js`
2. Update all components to use new API
3. Test each endpoint

### Phase 2D: Testing & Deploy (1 hour)
1. Test locally with `netlify dev`
2. Test all CRUD operations
3. Deploy to Netlify
4. Verify production works

**Total Time: 4-6 hours** (can do in one day!)

---

## ✅ Checklist

- [ ] Install `@neondatabase/serverless`
- [ ] Install `netlify-cli` (dev dependency)
- [ ] Create `netlify.toml` config
- [ ] Create `netlify/functions/lib/db.js`
- [ ] Create `netlify/functions/users.js`
- [ ] Create `netlify/functions/bookings.js`
- [ ] Create `netlify/functions/messages.js`
- [ ] Update `src/api/apiClient.js`
- [ ] Add environment variables to Netlify
- [ ] Test locally with `netlify dev`
- [ ] Deploy to Netlify
- [ ] Remove old Supabase client code
- [ ] Update all components

---

## 🎉 After Phase 2

**You'll have:**
- ✅ Database credentials secured server-side
- ✅ Serverless functions handling all data
- ✅ Automatic scaling with Netlify
- ✅ No server to manage
- ✅ Production-ready architecture

**Security Status:**
- Before Phase 2: 🟡 MEDIUM RISK (client-side DB access)
- After Phase 2: 🟢 **LOW RISK** (secure backend)

---

## 💡 Pro Tips

1. **Start Small:** Begin with one function (users), test it, then add more
2. **Use Netlify Dev:** `netlify dev` simulates production environment locally
3. **Environment Variables:** Add them in Netlify dashboard for production
4. **CORS:** Netlify functions handle CORS automatically
5. **Cold Starts:** First request might be slow (serverless), then fast

---

## 🚀 Ready to Start?

**Would you like me to:**
1. ✅ Create the Netlify functions structure
2. ✅ Set up the configuration files
3. ✅ Build the first API function (users)
4. ✅ Update the frontend to use the new API

**Just say "let's do it" and I'll start implementing Phase 2!** 🎯

---

## 📚 Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Neon Serverless Driver](https://neon.tech/docs/serverless/serverless-driver)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)

---

**Next Step:** Ready when you are! 🚀
