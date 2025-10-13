#!/usr/bin/env node

// Check for Tia Charles registration in auth logs
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;

async function checkTiaRegistration() {
  const client = new Client({
    connectionString: process.env.VITE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Searching for Tia Charles registration...\n');

    // Check auth_logs for any Tia-related entries
    const authResult = await client.query(`
      SELECT * FROM auth_logs 
      WHERE LOWER(user_email) LIKE '%tia%' OR LOWER(user_email) LIKE '%charles%'
      ORDER BY timestamp DESC
    `);

    console.log(`📋 Found ${authResult.rows.length} auth log entries for Tia:\n`);
    authResult.rows.forEach(log => {
      console.log(`  📝 ${log.event_type}: ${log.user_email} - ${log.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`     Time: ${new Date(log.timestamp).toLocaleString()}`);
      if (!log.success && log.error_details) {
        console.log(`     Error: ${log.error_details}`);
      }
      console.log('');
    });

    // Check email_logs for notifications sent about Tia
    const emailResult = await client.query(`
      SELECT * FROM email_logs 
      WHERE LOWER(to_email) LIKE '%tia%' OR LOWER(to_email) LIKE '%charles%'
         OR LOWER(subject) LIKE '%tia%' OR LOWER(subject) LIKE '%charles%'
      ORDER BY sent_at DESC
    `);

    console.log(`📧 Found ${emailResult.rows.length} email log entries for Tia:\n`);
    emailResult.rows.forEach(log => {
      console.log(`  📧 "${log.subject}" to ${log.to_email} - ${log.status.toUpperCase()}`);
      console.log(`     Time: ${new Date(log.sent_at).toLocaleString()}`);
      console.log('');
    });

    // Check for recent registrations in general
    console.log('📊 Recent registrations (last 24 hours):\n');
    const recentResult = await client.query(`
      SELECT * FROM auth_logs 
      WHERE event_type = 'signup' 
        AND timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY timestamp DESC
    `);

    recentResult.rows.forEach(log => {
      console.log(`  👤 ${log.user_email} - ${log.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`     Time: ${new Date(log.timestamp).toLocaleString()}`);
      if (!log.success && log.error_details) {
        console.log(`     Error: ${log.error_details}`);
      }
      console.log('');
    });

    if (recentResult.rows.length === 0) {
      console.log('  No registrations found in the last 24 hours.');
      console.log('  This suggests Tia\'s registration happened before the notification system was active.\n');
      
      console.log('💡 Solution: Since Tia registered before notifications were set up,');
      console.log('   she wouldn\'t have received a welcome email. You can:');
      console.log('   1. Manually send her a welcome email');
      console.log('   2. Test the notification system with a new registration');
    }

  } catch (error) {
    console.error('❌ Error checking registration:', error);
  } finally {
    await client.end();
  }
}

checkTiaRegistration();