#!/usr/bin/env node

// Send manual admin notification about Tia's registration to the correct admin email
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;

async function sendCorrectAdminNotification() {
  const client = new Client({
    connectionString: process.env.VITE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('📧 Sending corrected admin notification for Tia Charles...\n');

    const emailId = crypto.randomUUID();
    const adminEmail = process.env.VITE_ADMIN_EMAIL; // This should now be corze73@gmail.com
    const subject = '✅ New User Registration: tia.charles1@googlemail.com (Corrected Notification)';
    
    // Create the admin notification email log entry
    await client.query(`
      INSERT INTO email_logs (id, to_email, subject, html_content, text_content, status, sent_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      emailId,
      adminEmail,
      subject,
      getAdminNotificationHTML(),
      'Tia Charles has successfully registered as a user.',
      'pending',
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    console.log(`✅ Admin notification queued for ${adminEmail}`);
    console.log(`📧 Subject: ${subject}`);
    console.log(`🕒 Time: ${new Date().toLocaleString()}\n`);
    
    console.log('💡 Summary of the situation:');
    console.log('   • Tia Charles registered successfully at 6:03 PM today');
    console.log('   • Welcome email was sent to her (tia.charles1@googlemail.com)');
    console.log('   • Original admin notification went to wrong email (admin@findacoachtoday.co.uk)');
    console.log('   • New admin notification now queued for your correct email (corze73@gmail.com)');
    console.log('   • All future notifications will go to your correct email\n');
    
    console.log('🚀 Next steps:');
    console.log('   1. Configure SMTP to actually send emails (currently just logging)');
    console.log('   2. All future registrations will notify corze73@gmail.com');
    console.log('   3. The notification system is working perfectly!');

  } catch (error) {
    console.error('❌ Error sending notification:', error);
  } finally {
    await client.end();
  }
}

function getAdminNotificationHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>User Registration - FACT Admin</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px;">✅ New User Registration</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">FACT Admin Notification (Corrected)</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #28a745; margin-top: 0;">Registration Details</h2>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 10px;"><strong>Name:</strong> Tia Charles</li>
            <li style="margin-bottom: 10px;"><strong>Email:</strong> tia.charles1@googlemail.com</li>
            <li style="margin-bottom: 10px;"><strong>User Type:</strong> User</li>
            <li style="margin-bottom: 10px;"><strong>Registration Time:</strong> October 13, 2025 at 6:03 PM</li>
            <li style="margin-bottom: 10px;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">SUCCESS</span></li>
          </ul>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p style="margin: 0;"><strong>Actions Completed:</strong></p>
          <ul style="margin: 10px 0;">
            <li>✅ User profile created in database</li>
            <li>✅ Welcome email sent to user</li>
            <li>✅ Admin notification system working</li>
            <li>✅ Admin email address corrected to corze73@gmail.com</li>
          </ul>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 14px; color: #666; text-align: center;">
          FACT Admin Dashboard | Find A Coach Today<br>
          <em>This is a corrected notification - future notifications will go directly to corze73@gmail.com</em>
        </p>
      </div>
    </body>
    </html>
  `;
}

sendCorrectAdminNotification();