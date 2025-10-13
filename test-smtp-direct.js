#!/usr/bin/env node

// Simple SMTP test for Ionos email sending
import dotenv from 'dotenv';
import { createTransport } from 'nodemailer';

dotenv.config();

async function testSMTPConnection() {
  try {
    console.log('🧪 Testing Ionos SMTP Connection...\n');
    
    // Create transporter with your Ionos credentials
    // Try different SMTP configurations for Ionos
    const configs = [
      {
        name: 'Ionos UK SMTP (Port 587 with STARTTLS)',
        host: 'smtp.ionos.co.uk',
        port: 587,
        secure: false,
        requireTLS: true,
        tls: {
          ciphers: 'SSLv3'
        },
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      {
        name: 'Ionos UK SMTP (Port 465 SSL)',
        host: 'smtp.ionos.co.uk', 
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      {
        name: 'Ionos Global SMTP (Port 587)',
        host: 'smtp.ionos.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    ];

    let transporter = null;
    let workingConfig = null;
    
    // Try each configuration
    for (const config of configs) {
      try {
        console.log(`🔄 Trying ${config.name}...`);
        const testTransporter = createTransport(config);
        await testTransporter.verify();
        console.log(`✅ ${config.name} - Connection successful!`);
        transporter = testTransporter;
        workingConfig = config;
        break;
      } catch (error) {
        console.log(`❌ ${config.name} - Failed: ${error.message}`);
      }
    }
    
    if (!transporter) {
      throw new Error('All SMTP configurations failed. Please check your credentials.');
    }
    
    console.log('\n📋 Working SMTP Configuration:');
    console.log(`   Host: ${workingConfig.host}`);
    console.log(`   Port: ${workingConfig.port}`);
    console.log(`   Secure: ${workingConfig.secure}`);
    console.log(`   User: ${workingConfig.auth.user}`);
    console.log('   Password: [PROTECTED]\n');
    
    // Send test email to admin
    console.log('📧 Sending test email to admin...');
    const testEmail = {
      from: `"FACT Support" <${process.env.VITE_SUPPORT_EMAIL}>`,
      to: process.env.VITE_ADMIN_EMAIL,
      subject: '🎉 FACT Email System Test - SMTP Working!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 24px;">🎉 Email System Active!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">SMTP Connection Test Successful</p>
          </div>
          
          <h2 style="color: #059669;">✅ Test Results</h2>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
            <ul style="margin: 0; color: #065f46;">
              <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
              <li><strong>Connection:</strong> ✅ Successful</li>
              <li><strong>Authentication:</strong> ✅ Verified</li>
              <li><strong>Email Delivery:</strong> ✅ Working</li>
            </ul>
          </div>
          
          <h3 style="color: #059669; margin-top: 30px;">🚀 What This Means</h3>
          <p>Your FACT notification system can now send real emails! You'll receive notifications for:</p>
          <ul>
            <li>✅ New user registrations (like Tia Charles)</li>
            <li>✅ New coach registrations</li>
            <li>✅ Failed registration attempts</li>
            <li>✅ Security alerts (multiple failed logins)</li>
          </ul>
          
          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e40af; margin-top: 0;">📧 Email Configuration</h4>
            <p style="margin: 0; color: #1e3a8a;">
              <strong>From:</strong> ${process.env.VITE_SUPPORT_EMAIL}<br>
              <strong>Admin:</strong> ${process.env.VITE_ADMIN_EMAIL}<br>
              <strong>Provider:</strong> Ionos SMTP
            </p>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <strong>Your FACT email notification system is fully operational! 🎯</strong>
          </p>
        </div>
      `,
      text: 'FACT Email System Test - Your email notifications are now working via Ionos SMTP!'
    };
    
    const info = await transporter.sendMail(testEmail);
    console.log(`✅ Test email sent successfully!`);
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📬 Email sent to: ${process.env.VITE_ADMIN_EMAIL}\n`);
    
    // Send welcome email to Tia as well
    console.log('📧 Sending belated welcome email to Tia Charles...');
    const tiaEmail = {
      from: `"FACT Support" <${process.env.VITE_SUPPORT_EMAIL}>`,
      to: 'tia.charles1@googlemail.com',
      subject: '🎉 Welcome to FACT - Find Your Perfect Coach!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to FACT!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Find Your Perfect Coach</p>
          </div>
          
          <h2 style="color: #2c3e50;">Hi Tia! 👋</h2>
          <p>Welcome to <strong>Find A Coach Today (FACT)</strong>! We're thrilled to have you join our community of athletes and coaches.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">🚀 Getting Started</h3>
            <p>Your account is now active and you can:</p>
            <ul>
              <li>🔍 Browse our network of qualified coaches</li>
              <li>📅 Book training sessions that fit your schedule</li>
              <li>💬 Message coaches directly</li>
              <li>📊 Track your progress and improvement</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://findacoachtoday.co.uk" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Start Finding Coaches →
            </a>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💬 Need help?</strong> Reply to this email or contact us at <a href="mailto:${process.env.VITE_SUPPORT_EMAIL}">${process.env.VITE_SUPPORT_EMAIL}</a></p>
          </div>
          
          <p style="text-align: center; margin-top: 30px; color: #666;">
            Welcome to the FACT family! 🏈⚽🏀<br>
            <strong>The FACT Team</strong>
          </p>
        </div>
      `,
      text: 'Welcome to FACT! Your account is now active. Start finding your perfect coach today!'
    };
    
    const tiaInfo = await transporter.sendMail(tiaEmail);
    console.log(`✅ Welcome email sent to Tia!`);
    console.log(`📧 Message ID: ${tiaInfo.messageId}\n`);
    
    console.log('🎯 SMTP Test Results:');
    console.log('   ✅ Connection: SUCCESS');
    console.log('   ✅ Admin Test Email: SENT');
    console.log('   ✅ Tia Welcome Email: SENT');
    console.log('\n🎉 Your email system is fully operational!');
    console.log('📬 Check your email inbox for the test notification.');
    console.log('📬 Tia should receive her welcome email as well.');
    
  } catch (error) {
    console.error('❌ SMTP Test Failed:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   • SMTP username and password are correct');
      console.log('   • Email account has SMTP access enabled');
      console.log('   • No typos in credentials');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 Connection failed. Please check:');
      console.log('   • SMTP host and port are correct');
      console.log('   • Internet connection is working');
      console.log('   • Firewall is not blocking SMTP');
    }
  }
}

testSMTPConnection();