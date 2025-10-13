#!/usr/bin/env node

// Test specific Ionos SMTP authentication methods
import dotenv from 'dotenv';
import { createTransport } from 'nodemailer';

dotenv.config();

async function testIonosAuthentication() {
  try {
    console.log('🔧 Testing specific Ionos SMTP authentication methods...\n');
    
    const configs = [
      {
        name: 'Standard Authentication',
        config: {
          host: 'smtp.ionos.co.uk',
          port: 587,
          secure: false,
          auth: {
            user: 'support@findacoachtoday.com',
            pass: 'iwQ6HNpTEV4u8zB@#!F4c73*'
          }
        }
      },
      {
        name: 'With explicit TLS',
        config: {
          host: 'smtp.ionos.co.uk',
          port: 587,
          secure: false,
          requireTLS: true,
          auth: {
            user: 'support@findacoachtoday.com',
            pass: 'iwQ6HNpTEV4u8zB@#!F4c73*'
          }
        }
      },
      {
        name: 'With TLS options',
        config: {
          host: 'smtp.ionos.co.uk',
          port: 587,
          secure: false,
          requireTLS: true,
          tls: {
            rejectUnauthorized: false
          },
          auth: {
            user: 'support@findacoachtoday.com',
            pass: 'iwQ6HNpTEV4u8zB@#!F4c73*'
          }
        }
      },
      {
        name: 'Port 465 SSL',
        config: {
          host: 'smtp.ionos.co.uk',
          port: 465,
          secure: true,
          auth: {
            user: 'support@findacoachtoday.com',
            pass: 'iwQ6HNpTEV4u8zB@#!F4c73*'
          }
        }
      }
    ];

    let success = false;
    
    for (const { name, config } of configs) {
      try {
        console.log(`🔄 Testing: ${name}...`);
        const transporter = createTransport(config);
        
        // Test connection
        await transporter.verify();
        console.log(`✅ ${name} - Connection successful!`);
        
        // Try sending a test email
        console.log(`📧 Sending test email with ${name}...`);
        const info = await transporter.sendMail({
          from: '"FACT Support" <support@findacoachtoday.com>',
          to: 'corze73@gmail.com',
          subject: '✅ FACT Email Test - Authentication Successful!',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #28a745;">🎉 Success!</h2>
              <p>Your Ionos SMTP configuration is now working!</p>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>Configuration that worked:</strong><br>
                ${name}<br>
                Host: ${config.host}<br>
                Port: ${config.port}<br>
                Secure: ${config.secure}
              </div>
              <p>Your FACT notification system is now fully operational! 🚀</p>
            </div>
          `,
          text: `FACT Email Test Success! Configuration: ${name}`
        });
        
        console.log(`✅ Email sent successfully!`);
        console.log(`📧 Message ID: ${info.messageId}`);
        console.log(`\n🎯 Working configuration: ${name}`);
        console.log(`   Host: ${config.host}`);
        console.log(`   Port: ${config.port}`);
        console.log(`   Secure: ${config.secure}`);
        if (config.requireTLS) console.log(`   RequireTLS: ${config.requireTLS}`);
        
        success = true;
        break;
        
      } catch (error) {
        console.log(`❌ ${name} - Failed: ${error.message}`);
      }
    }
    
    if (!success) {
      console.log('\n🤔 All authentication methods failed. This suggests:');
      console.log('   1. The email account may not have SMTP enabled');
      console.log('   2. There may be additional security settings in Ionos');
      console.log('   3. The account might need specific SMTP activation');
      console.log('\n💡 Recommendation: Contact Ionos support to verify SMTP settings for support@findacoachtoday.com');
    } else {
      console.log('\n🎉 SMTP is now working! Your notification system is fully operational.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testIonosAuthentication();