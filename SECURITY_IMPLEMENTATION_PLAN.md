# 🛡️ FACT Security Implementation Plan
**For Production-Ready Worldwide Deployment**

---

## Phase 1: Critical Security Fixes (Days 1-3) 🚨

### Day 1: Database Security

#### 1.1 Remove Database Exposure from Frontend
**Current Issue:** Database URL exposed in client code

```bash
# Create backend API directory
mkdir -p api/routes
mkdir -p api/middleware
mkdir -p api/services
```

**Files to Create:**
- `api/server.js` - Express server with security middleware
- `api/middleware/auth.js` - JWT authentication
- `api/middleware/rateLimiter.js` - Rate limiting
- `api/routes/bookings.js` - Protected booking endpoints
- `api/routes/profiles.js` - Protected profile endpoints

**Environment Restructure:**
```bash
# Backend .env (NOT exposed to client)
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_...
JWT_SECRET=<generated-secret>
SESSION_SECRET=<generated-secret>

# Frontend .env (safe for client)
VITE_API_URL=https://api.findacoachtoday.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
VITE_GOOGLE_CLIENT_ID=...
```

#### 1.2 Add RLS Policies for New Tables

```sql
-- File: migrations/20251015_add_rls_for_availability.sql

-- Enable RLS on new tables
ALTER TABLE coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_recurring_availability ENABLE ROW LEVEL SECURITY;

-- Coach Availability Policies
CREATE POLICY "coach_availability_select" ON coach_availability
  FOR SELECT TO public
  USING (
    -- Anyone can view coach availability (public information)
    true
  );

CREATE POLICY "coach_availability_insert" ON coach_availability
  FOR INSERT TO public
  WITH CHECK (
    -- Only the coach or admin can add their availability
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY "coach_availability_update" ON coach_availability
  FOR UPDATE TO public
  USING (
    -- Only the coach or admin can update their availability
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY "coach_availability_delete" ON coach_availability
  FOR DELETE TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Coach Recurring Availability Policies (same pattern)
CREATE POLICY "coach_recurring_select" ON coach_recurring_availability
  FOR SELECT TO public USING (true);

CREATE POLICY "coach_recurring_insert" ON coach_recurring_availability
  FOR INSERT TO public
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY "coach_recurring_update" ON coach_recurring_availability
  FOR UPDATE TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY "coach_recurring_delete" ON coach_recurring_availability
  FOR DELETE TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );
```

---

### Day 2: Security Headers & Input Validation

#### 2.1 Add Security Headers (Vite Plugin)

```bash
npm install --save-dev vite-plugin-html
```

Create `vite-plugin-security-headers.js`:

```javascript
export default function securityHeaders() {
  return {
    name: 'security-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Content Security Policy
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.googletagmanager.com; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https: blob:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' https://api.findacoachtoday.com https://*.neon.tech https://accounts.google.com; " +
          "frame-src 'self' https://accounts.google.com; " +
          "object-src 'none'; " +
          "base-uri 'self'; " +
          "form-action 'self';"
        );
        
        // Other security headers
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        
        // HSTS (only in production with HTTPS)
        if (process.env.NODE_ENV === 'production') {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }
        
        next();
      });
    }
  };
}
```

#### 2.2 Input Validation with Zod

```bash
npm install zod
```

Create `src/lib/validation.js`:

```javascript
import { z } from 'zod';

// User validation schemas
export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: phoneSchema.optional(),
  location: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export const bookingSchema = z.object({
  coach_id: z.string().uuid(),
  service_type: z.enum(['Striker & Finishing', 'General & Sparring', 'Skill/Passing', 'Tactical Analysis']),
  booking_date: z.string().datetime(),
  duration_minutes: z.number().min(30).max(240),
  total_amount: z.number().min(0),
});

export const messageSchema = z.object({
  receiver_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

// Sanitization function
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .slice(0, 10000); // Max length
}

// Validate and sanitize wrapper
export function validateAndSanitize(schema, data) {
  // Sanitize all string fields
  const sanitized = Object.entries(data).reduce((acc, [key, value]) => {
    acc[key] = typeof value === 'string' ? sanitizeInput(value) : value;
    return acc;
  }, {});
  
  // Validate with schema
  return schema.parse(sanitized);
}
```

---

### Day 3: Rate Limiting & Bot Protection

#### 3.1 Rate Limiting Middleware

```bash
npm install express-rate-limit express-slow-down
```

Create `api/middleware/rateLimiter.js`:

```javascript
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Strict rate limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment endpoint rate limit (very strict)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payments per hour
  message: 'Payment rate limit exceeded.',
});

// Slow down repeated requests
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500,
});
```

#### 3.2 File Upload Security

```bash
npm install multer file-type
```

Create `api/middleware/uploadSecurity.js`:

```javascript
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'crypto';

const storage = multer.memoryStorage();

const fileFilter = async (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'), false);
  }
  
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
});

// Verify actual file type (not just extension)
export async function verifyFileType(buffer, allowedTypes) {
  const fileType = await fileTypeFromBuffer(buffer);
  
  if (!fileType || !allowedTypes.includes(fileType.mime)) {
    throw new Error('File type verification failed');
  }
  
  return fileType;
}

// Generate safe filename
export function generateSafeFilename(originalName) {
  const ext = originalName.split('.').pop();
  const hash = crypto.randomBytes(16).toString('hex');
  return `${hash}.${ext}`;
}
```

---

## Phase 2: Automated Security Monitoring (Days 4-7) 🤖

### Setup 1: Dependency Scanning with Snyk

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project (sends results to Snyk dashboard)
snyk monitor
```

**Create `.github/workflows/security-scan.yml`:**

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
          
      - name: Run npm audit
        run: npm audit --audit-level=high
        
      - name: Check for outdated packages
        run: npm outdated || true
      
      - name: Upload results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: snyk.sarif
```

### Setup 2: GitHub Dependabot

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    reviewers:
      - "your-team"
    labels:
      - "dependencies"
      - "security"
    
    # Auto-merge patch updates
    allow:
      - dependency-type: "all"
    
    # Group updates
    groups:
      security-updates:
        patterns:
          - "*"
        update-types:
          - "security"
```

### Setup 3: Real-Time Security Monitoring with Sentry

```bash
npm install @sentry/react @sentry/tracing
```

Create `src/lib/sentry.js`:

```javascript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        new BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Performance Monitoring
      tracesSampleRate: 0.1,
      
      // Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Security-specific tracking
      beforeSend(event, hint) {
        // Filter sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers?.Authorization;
        }
        
        // Alert on security issues
        if (event.tags?.security === true) {
          // Send to security team
          sendSecurityAlert(event);
        }
        
        return event;
      },
      
      // Track security-relevant errors
      ignoreErrors: [
        // Ignore browser extension errors
        /extension/i,
      ],
    });
  }
}

// Security alert function
async function sendSecurityAlert(event) {
  // Send to your monitoring service
  await fetch('/api/security/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'security_event',
      severity: event.level,
      message: event.message,
      timestamp: new Date().toISOString(),
      user: event.user?.id,
      tags: event.tags,
    }),
  });
}
```

### Setup 4: Security Alert System

Create `api/services/securityAlerts.js`:

```javascript
import { db } from '../config/database.js';

export class SecurityAlertService {
  static async logSecurityEvent(event) {
    await db.query(`
      INSERT INTO security_events 
        (event_type, severity, description, user_id, ip_address, user_agent, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      event.type,
      event.severity,
      event.description,
      event.userId,
      event.ipAddress,
      event.userAgent,
      JSON.stringify(event.metadata)
    ]);
    
    // Send alert if critical
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.sendAlert(event);
    }
  }
  
  static async sendAlert(event) {
    const alerts = [];
    
    // Email alert
    alerts.push(this.sendEmailAlert(event));
    
    // Slack alert
    if (process.env.SLACK_WEBHOOK_URL) {
      alerts.push(this.sendSlackAlert(event));
    }
    
    // SMS alert for critical events
    if (event.severity === 'critical') {
      alerts.push(this.sendSMSAlert(event));
    }
    
    await Promise.all(alerts);
  }
  
  static async sendEmailAlert(event) {
    const adminEmail = process.env.SECURITY_ADMIN_EMAIL;
    
    // Use your email service
    await sendEmail({
      to: adminEmail,
      subject: `🚨 Security Alert: ${event.type}`,
      html: `
        <h2>Security Event Detected</h2>
        <p><strong>Type:</strong> ${event.type}</p>
        <p><strong>Severity:</strong> ${event.severity}</p>
        <p><strong>Description:</strong> ${event.description}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>User:</strong> ${event.userId || 'Anonymous'}</p>
        <p><strong>IP:</strong> ${event.ipAddress}</p>
      `
    });
  }
  
  static async sendSlackAlert(event) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Security Alert: ${event.type}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Security Event Detected*\n*Type:* ${event.type}\n*Severity:* ${event.severity}\n*Description:* ${event.description}`
            }
          }
        ]
      })
    });
  }
  
  static async sendSMSAlert(event) {
    // Use Twilio or similar
    // await twilioClient.messages.create({...});
  }
}

// Security event types to monitor
export const SECURITY_EVENT_TYPES = {
  SUSPICIOUS_LOGIN: 'suspicious_login',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  DATA_BREACH_ATTEMPT: 'data_breach_attempt',
  UNUSUAL_ACTIVITY: 'unusual_activity',
  FAILED_AUTH_ATTEMPTS: 'failed_auth_attempts',
  PRIVILEGE_ESCALATION: 'privilege_escalation',
};
```

### Setup 5: Database Migration for Security Logging

Create `migrations/20251016_security_logging.sql`:

```sql
-- Security events logging table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    description TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_time TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

-- Session tracking for security
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail for sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_created ON security_events(created_at);
CREATE INDEX idx_failed_logins_email ON failed_login_attempts(email);
CREATE INDEX idx_failed_logins_ip ON failed_login_attempts(ip_address);
CREATE INDEX idx_failed_logins_time ON failed_login_attempts(attempt_time);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name);

-- Function to clean up old security events
CREATE OR REPLACE FUNCTION cleanup_old_security_events() RETURNS void AS $$
BEGIN
    -- Keep only last 90 days of low/medium events
    DELETE FROM security_events 
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND severity IN ('low', 'medium');
    
    -- Keep 1 year of high/critical events
    DELETE FROM security_events 
    WHERE created_at < NOW() - INTERVAL '1 year'
      AND severity IN ('high', 'critical')
      AND resolved = true;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-security-events', '0 2 * * *', 'SELECT cleanup_old_security_events()');
```

---

## Phase 3: Production Hardening (Days 8-14) 🔐

### 1. Secrets Management

**Option A: AWS Secrets Manager**
```bash
npm install @aws-sdk/client-secrets-manager
```

**Option B: HashiCorp Vault**
```bash
npm install node-vault
```

**Option C: Environment-based with encryption**
```bash
# Use encrypted env files
npm install dotenv-vault
npx dotenv-vault new
npx dotenv-vault login
npx dotenv-vault push
```

### 2. WAF & DDoS Protection

**Recommended: Cloudflare**
- Automatic DDoS protection
- Web Application Firewall
- Bot protection
- Rate limiting at edge
- SSL/TLS encryption

**Setup:**
1. Point DNS to Cloudflare
2. Enable "Under Attack Mode" if needed
3. Configure firewall rules
4. Enable Bot Fight Mode

### 3. Security Compliance Documentation

Create security documentation:
- Privacy Policy (GDPR compliant)
- Terms of Service
- Data Processing Agreement
- Security Incident Response Plan
- PCI DSS compliance docs (for payments)
- SOC 2 preparation (if needed)

---

## Monitoring Dashboard Setup

### Recommended Tools Stack:

1. **Grafana** - Security metrics dashboard
2. **Prometheus** - Metrics collection
3. **Elasticsearch** - Log aggregation
4. **Kibana** - Log visualization

### Key Metrics to Track:

- Failed login attempts (per IP, per user)
- API error rates
- Response times (detect DoS)
- Database query times (detect SQL injection)
- File upload sizes/types
- Rate limit hits
- Unusual traffic patterns
- Geographic anomalies
- Session durations
- Payment fraud indicators

---

## Security Checklist Before Launch

```
🚨 CRITICAL
[.] Database credentials not in client code
[ ] RLS policies on all tables
[ ] Security headers configured
[ ] Rate limiting enabled
[ ] Input validation on all endpoints
[ ] File upload security
[ ] Stripe keys secured (not in frontend)

⚠️ HIGH
[ ] Automated security scanning
[ ] Dependency vulnerability alerts
[ ] Security event logging
[ ] Real-time alerting system
[ ] Session management secure
[ ] CORS configured correctly
[ ] CSP policy in place

📋 IMPORTANT
[ ] Penetration testing completed
[ ] Security documentation
[ ] Incident response plan
[ ] Privacy policy published
[ ] Terms of service updated
[ ] GDPR compliance reviewed
[ ] PCI DSS requirements met
[ ] Backup & recovery tested
```

---

## Monthly Security Tasks

- [ ] Review security event logs
- [ ] Update dependencies
- [ ] Rotate secrets/credentials
- [ ] Review user permissions
- [ ] Audit failed login attempts
- [ ] Check for unusual activity
- [ ] Update security documentation
- [ ] Test incident response procedures
- [ ] Review and update firewall rules
- [ ] Penetration testing (quarterly)

---

## Cost Estimates (Monthly)

- Snyk Pro: $99/month
- Sentry Business: $80/month
- Cloudflare Pro: $20/month
- AWS Secrets Manager: ~$5/month
- Security monitoring tools: $100-200/month
- **Total: ~$300-400/month**

**One-time:**
- Penetration testing: $3,000-10,000
- Security audit: $5,000-15,000
- Compliance certification: $10,000+

---

**Next Step:** Start with Phase 1, Day 1 - Database Security
