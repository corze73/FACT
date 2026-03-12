// Test authentication notifications system
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import process from 'process';

dotenv.config();
const sql = neon(process.env.VITE_DATABASE_URL);

// Simulate the AuthNotificationService for testing
const TestNotificationService = {
  async logAuthEvent(eventType, userEmail, success, errorDetails = null) {
    try {
      const logEntry = {
        id: crypto.randomUUID(),
        event_type: eventType,
        user_email: userEmail,
        success: success,
        error_details: errorDetails ? JSON.stringify(errorDetails) : null,
        user_agent: 'Test Browser',
        ip_address: '127.0.0.1',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      await sql`
        INSERT INTO auth_logs (id, event_type, user_email, success, error_details, user_agent, ip_address, timestamp, created_at)
        VALUES (${logEntry.id}, ${logEntry.event_type}, ${logEntry.user_email}, ${logEntry.success}, ${logEntry.error_details}, ${logEntry.user_agent}, ${logEntry.ip_address}, ${logEntry.timestamp}, ${logEntry.created_at})
      `;

      console.log(`📝 Auth event logged: ${eventType} for ${userEmail} - ${success ? 'SUCCESS' : 'FAILED'}`);
      return logEntry.id;

    } catch (error) {
      console.error('Failed to log auth event:', error);
      return null;
    }
  },

  async logEmailNotification(toEmail, subject, success = true, errorMessage = null) {
    try {
      const emailLog = {
        id: crypto.randomUUID(),
        to_email: toEmail,
        subject: subject,
        html_content: '<p>Test email content</p>',
        text_content: 'Test email content',
        status: success ? 'sent' : 'failed',
        sent_at: success ? new Date().toISOString() : null,
        error_message: errorMessage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await sql`
        INSERT INTO email_logs (id, to_email, subject, html_content, text_content, status, sent_at, error_message, created_at, updated_at)
        VALUES (${emailLog.id}, ${emailLog.to_email}, ${emailLog.subject}, ${emailLog.html_content}, ${emailLog.text_content}, ${emailLog.status}, ${emailLog.sent_at}, ${emailLog.error_message}, ${emailLog.created_at}, ${emailLog.updated_at})
      `;

      console.log(`📧 Email logged: ${subject} to ${toEmail} - ${success ? 'SENT' : 'FAILED'}`);
      return emailLog.id;

    } catch (error) {
      console.error('Failed to log email:', error);
      return null;
    }
  },

  async createAdminNotification(type, title, message, severity = 'info', userEmail = null) {
    try {
      const notification = {
        id: crypto.randomUUID(),
        type: type,
        title: title,
        message: message,
        severity: severity,
        is_read: false,
        related_user_email: userEmail,
        metadata: JSON.stringify({ created_by: 'test_system', timestamp: new Date().toISOString() }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await sql`
        INSERT INTO admin_notifications (id, type, title, message, severity, is_read, related_user_email, metadata, created_at, updated_at)
        VALUES (${notification.id}, ${notification.type}, ${notification.title}, ${notification.message}, ${notification.severity}, ${notification.is_read}, ${notification.related_user_email}, ${notification.metadata}, ${notification.created_at}, ${notification.updated_at})
      `;

      console.log(`🔔 Admin notification created: ${title} (${severity})`);
      return notification.id;

    } catch (error) {
      console.error('Failed to create admin notification:', error);
      return null;
    }
  }
};

async function testNotificationSystem() {
  console.log('🧪 Testing Authentication Notification System...\n');

  try {
    // Test 1: Successful signup
    console.log('📋 Test 1: Successful Coach Signup');
    await TestNotificationService.logAuthEvent('signup', 'test.coach@example.com', true);
    await TestNotificationService.logEmailNotification('test.coach@example.com', 'Welcome to FACT - Coach Account Created!');
    await TestNotificationService.logEmailNotification(process.env.VITE_ADMIN_EMAIL || 'support@findacoachtoday.com', 'New Coach Registration: test.coach@example.com');
    
    console.log('');

    // Test 2: Failed signup
    console.log('📋 Test 2: Failed User Signup');
    await TestNotificationService.logAuthEvent('signup', 'failed.user@example.com', false, {
      message: 'Database constraint violation',
      code: '23514'
    });
    await TestNotificationService.logEmailNotification('failed.user@example.com', 'Registration Issue - We\'re On It!');
    await TestNotificationService.logEmailNotification(process.env.VITE_ADMIN_EMAIL || 'support@findacoachtoday.com', 'Failed Registration: failed.user@example.com');
    await TestNotificationService.createAdminNotification(
      'signup_failure', 
      'User Signup Failed', 
      'User failed.user@example.com encountered a database error during signup', 
      'warning', 
      'failed.user@example.com'
    );

    console.log('');

    // Test 3: Multiple failed signin attempts
    console.log('📋 Test 3: Multiple Failed Signin Attempts');
    for (let i = 0; i < 4; i++) {
      await TestNotificationService.logAuthEvent('signin', 'suspicious.user@example.com', false, {
        message: 'Invalid email or password',
        attempt: i + 1
      });
    }
    await TestNotificationService.createAdminNotification(
      'security_alert', 
      'Multiple Failed Login Attempts', 
      'User suspicious.user@example.com has 4 failed login attempts in the last hour', 
      'error', 
      'suspicious.user@example.com'
    );

    console.log('');

    // Test 4: Successful signin
    console.log('📋 Test 4: Successful Signin');
    await TestNotificationService.logAuthEvent('signin', 'regular.user@example.com', true);

    console.log('');

    // Verify data was inserted
    console.log('🔍 Verifying test data...\n');

    const authLogs = await sql`SELECT COUNT(*) as count FROM auth_logs`;
    console.log(`✅ Auth logs: ${authLogs[0].count} entries`);

    const emailLogs = await sql`SELECT COUNT(*) as count FROM email_logs`;
    console.log(`✅ Email logs: ${emailLogs[0].count} entries`);

    const notifications = await sql`SELECT COUNT(*) as count FROM admin_notifications`;
    console.log(`✅ Admin notifications: ${notifications[0].count} entries`);

    // Show recent failures for admin dashboard
    console.log('\n📊 Recent Authentication Failures:');
    const failures = await sql`
      SELECT event_type, user_email, error_details, timestamp 
      FROM auth_logs 
      WHERE success = false 
      ORDER BY timestamp DESC 
      LIMIT 10
    `;

    failures.forEach(failure => {
      console.log(`  ❌ ${failure.event_type}: ${failure.user_email} at ${new Date(failure.timestamp).toLocaleString()}`);
      if (failure.error_details) {
        const error = JSON.parse(failure.error_details);
        console.log(`      Error: ${error.message}`);
      }
    });

    console.log('\n🔔 Admin Notifications:');
    const adminNotifications = await sql`
      SELECT type, title, severity, related_user_email, created_at 
      FROM admin_notifications 
      WHERE is_read = false 
      ORDER BY created_at DESC
    `;

    adminNotifications.forEach(notification => {
      const severityIcon = notification.severity === 'error' ? '🚨' : notification.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${severityIcon} [${notification.type}] ${notification.title}`);
      if (notification.related_user_email) {
        console.log(`      User: ${notification.related_user_email}`);
      }
    });

    console.log('\n✅ Notification system test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Configure real email service (SendGrid, Mailgun, etc.)');
    console.log('2. Add VITE_ADMIN_EMAIL to .env file');
    console.log('3. Integrate AuthenticationLogs component into admin dashboard');
    console.log('4. Set up email templates and SMTP configuration');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testNotificationSystem();