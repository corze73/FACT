// Email notification service for authentication events
import { db } from './databaseClient.js';
import nodemailer from 'nodemailer';

// Create SMTP transporter for Ionos
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: import.meta.env.SMTP_HOST,
    port: parseInt(import.meta.env.SMTP_PORT),
    secure: import.meta.env.SMTP_SECURE === 'true',
    auth: {
      user: import.meta.env.SMTP_USER,
      pass: import.meta.env.SMTP_PASS
    }
  });
};

export const EmailService = {
  // Send email via Ionos SMTP
  async sendEmail(to, subject, htmlContent, textContent = '') {
    try {
      const emailLog = {
        id: crypto.randomUUID(),
        to_email: to,
        subject: subject,
        html_content: htmlContent,
        text_content: textContent,
        status: 'sending',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      // Log email attempt
      await this.logEmail(emailLog);
      
      // Send actual email via Ionos SMTP
      try {
        const transporter = createTransporter();
        
        const mailOptions = {
          from: `"FACT Support" <${import.meta.env.VITE_SUPPORT_EMAIL}>`,
          to: to,
          subject: subject,
          html: htmlContent,
          text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
        };

        const info = await transporter.sendMail(mailOptions);
        
        // Update email log as sent
        await this.updateEmailStatus(emailLog.id, 'sent', info.messageId);
        
        console.log(`📧 Email sent: ${subject} to ${to} - Message ID: ${info.messageId}`);
        return { success: true, emailId: emailLog.id, messageId: info.messageId };

      } catch (smtpError) {
        // Update email log as failed
        await this.updateEmailStatus(emailLog.id, 'failed', null, smtpError.message);
        
        console.error(`❌ Email failed: ${subject} to ${to}`, smtpError.message);
        return { success: false, error: smtpError.message, emailId: emailLog.id };
      }

    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  },

  // Log email attempts to database
  async logEmail(emailData) {
    try {
      await db.query(`
        INSERT INTO email_logs (id, to_email, subject, html_content, text_content, status, sent_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        emailData.id,
        emailData.to_email,
        emailData.subject,
        emailData.html_content,
        emailData.text_content,
        emailData.status,
        emailData.sent_at,
        emailData.created_at
      ]);
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  },

  // Update email status in database
  async updateEmailStatus(emailId, status, messageId = null, errorMessage = null) {
    try {
      await db.query(`
        UPDATE email_logs 
        SET status = $1, message_id = $2, error_message = $3, updated_at = $4
        WHERE id = $5
      `, [status, messageId, errorMessage, new Date().toISOString(), emailId]);
    } catch (error) {
      console.error('Failed to update email status:', error);
    }
  },

  // Admin notification for signup events
  async notifyAdminOfSignup(userEmail, userType, success, errorDetails = null) {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@findacoachtoday.co.uk';
    
    const subject = success 
      ? `✅ New ${userType} Registration: ${userEmail}`
      : `❌ Failed ${userType} Registration: ${userEmail}`;

    const htmlContent = success 
      ? this.getSuccessfulSignupAdminTemplate(userEmail, userType)
      : this.getFailedSignupAdminTemplate(userEmail, userType, errorDetails);

    return await this.sendEmail(adminEmail, subject, htmlContent);
  },

  // Welcome email for successful signups
  async sendWelcomeEmail(userEmail, userName, userType) {
    const subject = userType === 'coach' 
      ? '🎉 Welcome to FACT - Start Coaching Today!'
      : '🎉 Welcome to FACT - Find Your Perfect Coach!';

    const htmlContent = userType === 'coach'
      ? this.getCoachWelcomeTemplate(userName, userEmail)
      : this.getUserWelcomeTemplate(userName, userEmail);

    return await this.sendEmail(userEmail, subject, htmlContent);
  },

  // Failure notification for users
  async sendSignupFailureEmail(userEmail, userName = 'User') {
    const subject = '⚠️ Registration Issue - We\'re On It!';
    const htmlContent = this.getSignupFailureTemplate(userName);

    return await this.sendEmail(userEmail, subject, htmlContent);
  },

  // Email templates
  getSuccessfulSignupAdminTemplate(userEmail, userType) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Registration - FACT Admin</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">✅ New Registration</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">FACT Admin Notification</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #28a745; margin-top: 0;">Successful Registration</h2>
            <ul style="list-style: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Email:</strong> ${userEmail}</li>
              <li style="margin-bottom: 10px;"><strong>User Type:</strong> ${userType.charAt(0).toUpperCase() + userType.slice(1)}</li>
              <li style="margin-bottom: 10px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
              <li style="margin-bottom: 10px;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">SUCCESS</span></li>
            </ul>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
            <p style="margin: 0;"><strong>Next Steps:</strong></p>
            <ul style="margin: 10px 0;">
              <li>User has been sent a welcome email</li>
              <li>Profile created in database</li>
              ${userType === 'coach' ? '<li>Coach profile ready for completion</li>' : '<li>User can start browsing coaches</li>'}
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 14px; color: #666; text-align: center;">
            FACT Admin Dashboard | Find A Coach Today
          </p>
        </div>
      </body>
      </html>
    `;
  },

  getFailedSignupAdminTemplate(userEmail, userType, errorDetails) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Failed Registration - FACT Admin</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">❌ Registration Failed</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">FACT Admin Alert</p>
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin-top: 0;">Failed Registration Details</h2>
            <ul style="list-style: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Email:</strong> ${userEmail}</li>
              <li style="margin-bottom: 10px;"><strong>User Type:</strong> ${userType.charAt(0).toUpperCase() + userType.slice(1)}</li>
              <li style="margin-bottom: 10px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
              <li style="margin-bottom: 10px;"><strong>Status:</strong> <span style="color: #dc3545; font-weight: bold;">FAILED</span></li>
            </ul>
          </div>

          ${errorDetails ? `
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
            <h3 style="color: #721c24; margin-top: 0;">Error Details</h3>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(errorDetails, null, 2)}</pre>
          </div>
          ` : ''}

          <div style="background: #f1f3f4; padding: 15px; border-radius: 8px;">
            <p style="margin: 0;"><strong>Action Required:</strong></p>
            <ul style="margin: 10px 0;">
              <li>User has been notified of the issue</li>
              <li>Error has been logged for investigation</li>
              <li>Check admin dashboard for details</li>
              <li>Consider reaching out to user if needed</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 14px; color: #666; text-align: center;">
            FACT Admin Dashboard | Find A Coach Today
          </p>
        </div>
      </body>
      </html>
    `;
  },

  getCoachWelcomeTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome Coach - FACT</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; border-radius: 8px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to FACT!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Ready to start coaching?</p>
          </div>
          
          <div style="padding: 20px 0;">
            <h2 style="color: #2c3e50;">Hi ${userName}! 👋</h2>
            <p>Welcome to <strong>Find A Coach Today (FACT)</strong> - the premier platform connecting talented football coaches with aspiring players across the UK!</p>
            
            <p>Your coach account has been successfully created. You're now part of our growing community of professional football coaches.</p>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2e7d32; margin-top: 0;">🚀 Next Steps to Get Started:</h3>
            <ol style="color: #2e7d32;">
              <li><strong>Complete Your Profile</strong> - Add your experience, certifications, and coaching specialties</li>
              <li><strong>Set Your Availability</strong> - Let players know when you're free to coach</li>
              <li><strong>Upload Photos</strong> - Add a professional profile picture and action shots</li>
              <li><strong>Set Your Rates</strong> - Define your hourly coaching fees</li>
              <li><strong>Go Live!</strong> - Start receiving booking requests from players</li>
            </ol>
          </div>

          <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1565c0; margin-top: 0;">⚽ What You Can Do:</h3>
            <ul style="color: #1565c0;">
              <li>Receive and manage booking requests</li>
              <li>Set your coaching preferences and age groups</li>
              <li>Communicate with players through our messaging system</li>
              <li>Manage your schedule and availability</li>
              <li>Receive payments securely through our platform</li>
              <li>Build your coaching reputation with reviews</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${import.meta.env.VITE_APP_URL || 'https://findacoachtoday.co.uk'}/dashboard" 
               style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Complete Your Profile →
            </a>
          </div>

          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #e65100;"><strong>💡 Pro Tip:</strong> Coaches with complete profiles and great photos get 3x more bookings!</p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <div style="text-align: center; color: #666; font-size: 14px;">
            <p>Need help? Reply to this email or contact us at <a href="mailto:support@findacoachtoday.co.uk">support@findacoachtoday.co.uk</a></p>
            <p>Welcome to the FACT family! 🏆</p>
            <p style="margin-top: 20px;">
              <strong>Find A Coach Today</strong><br>
              Connecting Coaches & Players Across the UK
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  getUserWelcomeTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome Player - FACT</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); padding: 30px; border-radius: 8px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to FACT!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Find your perfect coach today</p>
          </div>
          
          <div style="padding: 20px 0;">
            <h2 style="color: #2c3e50;">Hi ${userName}! ⚽</h2>
            <p>Welcome to <strong>Find A Coach Today (FACT)</strong> - your gateway to finding amazing football coaches across the UK!</p>
            
            <p>Your account has been successfully created. You're now ready to discover and book sessions with professional football coaches in your area.</p>
          </div>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1565c0; margin-top: 0;">🔍 How to Find Your Perfect Coach:</h3>
            <ol style="color: #1565c0;">
              <li><strong>Browse Coaches</strong> - Explore profiles, read reviews, and check availability</li>
              <li><strong>Filter by Needs</strong> - Find coaches by location, age group, and speciality</li>
              <li><strong>Read Reviews</strong> - See what other players say about their experiences</li>
              <li><strong>Book Sessions</strong> - Send booking requests and get confirmed quickly</li>
              <li><strong>Train & Improve</strong> - Work with your coach to reach your goals</li>
            </ol>
          </div>

          <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #7b1fa2; margin-top: 0;">⚽ What's Available:</h3>
            <ul style="color: #7b1fa2;">
              <li><strong>1-on-1 Coaching</strong> - Personalized training sessions</li>
              <li><strong>Group Sessions</strong> - Train with friends or join existing groups</li>
              <li><strong>Skill Development</strong> - Striker training, goalkeeping, midfield play</li>
              <li><strong>Age Groups</strong> - Coaches for under 8s to adult players</li>
              <li><strong>Flexible Scheduling</strong> - Morning, afternoon, evening, and weekend slots</li>
              <li><strong>All Locations</strong> - Find coaches near you across the UK</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${import.meta.env.VITE_APP_URL || 'https://findacoachtoday.co.uk'}/coaches" 
               style="background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Find Coaches Now →
            </a>
          </div>

          <div style="background: #fff8e1; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #f57c00;"><strong>⭐ Pro Tip:</strong> Book your first session within 24 hours and many coaches offer a "first session" discount!</p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <div style="text-align: center; color: #666; font-size: 14px;">
            <p>Questions? Reply to this email or contact us at <a href="mailto:support@findacoachtoday.co.uk">support@findacoachtoday.co.uk</a></p>
            <p>Ready to take your game to the next level? 🚀</p>
            <p style="margin-top: 20px;">
              <strong>Find A Coach Today</strong><br>
              Connecting Coaches & Players Across the UK
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  getSignupFailureTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Issue - FACT Support</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 30px; border-radius: 8px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Registration Issue</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We're on it!</p>
          </div>
          
          <div style="padding: 20px 0;">
            <h2 style="color: #2c3e50;">Hi ${userName},</h2>
            <p>Thank you for trying to join <strong>Find A Coach Today (FACT)</strong>!</p>
            
            <p>We encountered a technical issue while processing your registration. Don't worry - this has been automatically logged and our support team is already looking into it.</p>
          </div>

          <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <h3 style="color: #e65100; margin-top: 0;">🔧 What's Happening:</h3>
            <ul style="color: #e65100;">
              <li>Your registration attempt has been logged with reference ID: <code>${crypto.randomUUID().slice(0, 8)}</code></li>
              <li>Our technical team has been automatically notified</li>
              <li>We're working to resolve this issue quickly</li>
              <li>You'll receive an update within 24 hours</li>
            </ul>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2e7d32; margin-top: 0;">✅ What You Can Do:</h3>
            <ol style="color: #2e7d32;">
              <li><strong>Try Again Later</strong> - The issue may already be resolved</li>
              <li><strong>Clear Your Browser Cache</strong> - Sometimes this helps with form submissions</li>
              <li><strong>Use a Different Browser</strong> - Try Chrome, Firefox, or Safari</li>
              <li><strong>Contact Support</strong> - We're here to help if you continue having issues</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${import.meta.env.VITE_APP_URL || 'https://findacoachtoday.co.uk'}/register" 
               style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; margin-right: 10px;">
              Try Again →
            </a>
            <a href="mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@findacoachtoday.com'}" 
               style="background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Contact Support →
            </a>
          </div>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #555;"><strong>💬 Need immediate help?</strong> Reply to this email or contact us at <a href="mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@findacoachtoday.com'}">${import.meta.env.VITE_SUPPORT_EMAIL || 'support@findacoachtoday.com'}</a> - we typically respond within 2 hours during business hours.</p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <div style="text-align: center; color: #666; font-size: 14px;">
            <p>We apologize for any inconvenience and appreciate your patience!</p>
            <p style="margin-top: 20px;">
              <strong>FACT Support Team</strong><br>
              Find A Coach Today
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};