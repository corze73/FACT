#!/usr/bin/env node

// Test the real SMTP email sending
import dotenv from 'dotenv';
import { EmailService } from './src/api/emailService.js';

dotenv.config();

async function testRealEmailSending() {
  try {
    console.log('🧪 Testing Real Email Sending with Ionos SMTP...\n');
    
    // Test 1: Send a test welcome email to Tia
    console.log('📋 Test 1: Sending welcome email to Tia Charles');
    const tiaResult = await EmailService.sendWelcomeEmail(
      'tia.charles1@googlemail.com', 
      'Tia Charles', 
      'user'
    );
    
    if (tiaResult.success) {
      console.log(`✅ Welcome email sent to Tia - Message ID: ${tiaResult.messageId}`);
    } else {
      console.log(`❌ Welcome email failed: ${tiaResult.error}`);
    }
    console.log('');
    
    // Test 2: Send admin notification to you
    console.log('📋 Test 2: Sending admin notification to corze73@gmail.com');
    const adminResult = await EmailService.notifyAdminOfSignup(
      'tia.charles1@googlemail.com',
      'user',
      true
    );
    
    if (adminResult.success) {
      console.log(`✅ Admin notification sent - Message ID: ${adminResult.messageId}`);
    } else {
      console.log(`❌ Admin notification failed: ${adminResult.error}`);
    }
    console.log('');
    
    // Test 3: Send a test email directly to you
    console.log('📋 Test 3: Sending test email directly to admin');
    const testResult = await EmailService.sendEmail(
      'corze73@gmail.com',
      '🎉 FACT Email System is Live!',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">🎉 FACT Email System is Active!</h1>
          <p>Congratulations! Your FACT notification system is now sending real emails.</p>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>✅ What's Working:</h3>
            <ul>
              <li>✅ Ionos SMTP connection established</li>
              <li>✅ Welcome emails for new users/coaches</li>
              <li>✅ Admin notifications for all events</li>
              <li>✅ Failure notifications with support contact</li>
              <li>✅ Email logging and status tracking</li>
            </ul>
          </div>
          <p><strong>From now on, you'll receive real email notifications for:</strong></p>
          <ul>
            <li>New user registrations</li>
            <li>New coach registrations</li>
            <li>Failed registration attempts</li>
            <li>Security alerts (multiple failed logins)</li>
          </ul>
          <p>Best regards,<br><strong>FACT Notification System</strong></p>
        </div>
      `,
      'FACT Email System is Live! Your notification system is now sending real emails via Ionos SMTP.'
    );
    
    if (testResult.success) {
      console.log(`✅ Test email sent to admin - Message ID: ${testResult.messageId}`);
    } else {
      console.log(`❌ Test email failed: ${testResult.error}`);
    }
    console.log('');
    
    console.log('🎯 Email System Test Results:');
    console.log(`   Tia Welcome Email: ${tiaResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Admin Notification: ${adminResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Direct Test Email: ${testResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (tiaResult.success && adminResult.success && testResult.success) {
      console.log('\n🎉 All tests passed! Your email system is fully operational.');
      console.log('📧 Check your email inbox (corze73@gmail.com) for the notifications.');
      console.log('📧 Tia should also receive her welcome email.');
    } else {
      console.log('\n⚠️  Some tests failed. Check your SMTP configuration.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealEmailSending();