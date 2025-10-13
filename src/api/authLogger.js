// Authentication event logging service
import { db } from './databaseClient';
import { EmailService } from './emailService';

export const AuthLogger = {
  // Log authentication events to database
  async logAuthEvent(eventType, userEmail, success, errorDetails = null, userAgent = '', ipAddress = '') {
    try {
      const logEntry = {
        id: crypto.randomUUID(),
        event_type: eventType, // 'signup', 'signin', 'signout', 'password_reset'
        user_email: userEmail,
        success: success,
        error_details: errorDetails ? JSON.stringify(errorDetails) : null,
        user_agent: userAgent,
        ip_address: ipAddress,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      await db.query(`
        INSERT INTO auth_logs (id, event_type, user_email, success, error_details, user_agent, ip_address, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        logEntry.id,
        logEntry.event_type,
        logEntry.user_email,
        logEntry.success,
        logEntry.error_details,
        logEntry.user_agent,
        logEntry.ip_address,
        logEntry.timestamp,
        logEntry.created_at
      ]);

      console.log(`📝 Auth event logged: ${eventType} for ${userEmail} - ${success ? 'SUCCESS' : 'FAILED'}`);
      return logEntry.id;

    } catch (error) {
      console.error('Failed to log auth event:', error);
      return null;
    }
  },

  // Get recent authentication logs for admin dashboard
  async getRecentAuthLogs(limit = 50) {
    try {
      const logs = await db.query(`
        SELECT * FROM auth_logs 
        ORDER BY timestamp DESC 
        LIMIT $1
      `, [limit]);

      return logs;
    } catch (error) {
      console.error('Failed to fetch auth logs:', error);
      return [];
    }
  },

  // Get failed authentication attempts
  async getFailedAuthAttempts(timeframe = '24 hours') {
    try {
      const logs = await db.query(`
        SELECT * FROM auth_logs 
        WHERE success = false 
        AND timestamp >= NOW() - INTERVAL $1
        ORDER BY timestamp DESC
      `, [timeframe]);

      return logs;
    } catch (error) {
      console.error('Failed to fetch failed auth attempts:', error);
      return [];
    }
  },

  // Get auth stats for dashboard
  async getAuthStats(timeframe = '7 days') {
    try {
      const stats = await db.query(`
        SELECT 
          event_type,
          success,
          COUNT(*) as count,
          DATE_TRUNC('day', timestamp) as date
        FROM auth_logs 
        WHERE timestamp >= NOW() - INTERVAL $1
        GROUP BY event_type, success, DATE_TRUNC('day', timestamp)
        ORDER BY date DESC
      `, [timeframe]);

      return stats;
    } catch (error) {
      console.error('Failed to fetch auth stats:', error);
      return [];
    }
  }
};

// Enhanced authentication service with notifications
export const AuthNotificationService = {
  // Handle signup events with full notification flow
  async handleSignupEvent(userEmail, userName, userType, success, errorDetails = null) {
    try {
      // Get user agent and IP (if available in browser context)
      const userAgent = navigator?.userAgent || 'Unknown';
      const ipAddress = 'client-side'; // Would need server-side implementation for real IP

      // Log the event
      const logId = await AuthLogger.logAuthEvent(
        'signup', 
        userEmail, 
        success, 
        errorDetails, 
        userAgent, 
        ipAddress
      );

      if (success) {
        // Send welcome email to user
        console.log('📧 Sending welcome email...');
        await EmailService.sendWelcomeEmail(userEmail, userName, userType);

        // Notify admin of successful signup
        console.log('📧 Notifying admin of successful signup...');
        await EmailService.notifyAdminOfSignup(userEmail, userType, true);

        console.log('✅ Signup notifications completed successfully');
        return { success: true, logId };

      } else {
        // Send failure notification to user
        console.log('📧 Sending failure notification to user...');
        await EmailService.sendSignupFailureEmail(userEmail, userName);

        // Notify admin of failed signup
        console.log('📧 Notifying admin of failed signup...');
        await EmailService.notifyAdminOfSignup(userEmail, userType, false, errorDetails);

        console.log('⚠️ Signup failure notifications completed');
        return { success: false, logId, notified: true };
      }

    } catch (error) {
      console.error('Error in signup notification flow:', error);
      return { success: false, error: error.message };
    }
  },

  // Handle signin events
  async handleSigninEvent(userEmail, success, errorDetails = null) {
    try {
      const userAgent = navigator?.userAgent || 'Unknown';
      const ipAddress = 'client-side';

      // Log the event
      const logId = await AuthLogger.logAuthEvent(
        'signin', 
        userEmail, 
        success, 
        errorDetails, 
        userAgent, 
        ipAddress
      );

      // For failed signin attempts, notify admin if there are multiple failures
      if (!success) {
        const recentFailures = await AuthLogger.getFailedAuthAttempts('1 hour');
        const userFailures = recentFailures.filter(log => 
          log.user_email === userEmail && log.event_type === 'signin'
        );

        // If 3+ failed attempts in an hour, notify admin
        if (userFailures.length >= 3) {
          console.log('🚨 Multiple signin failures detected, notifying admin...');
          await EmailService.notifyAdminOfSignup(
            userEmail, 
            'user', 
            false, 
            { 
              reason: 'Multiple failed signin attempts',
              attempts: userFailures.length,
              timeframe: '1 hour'
            }
          );
        }
      }

      return { success, logId };

    } catch (error) {
      console.error('Error in signin notification flow:', error);
      return { success: false, error: error.message };
    }
  }
};