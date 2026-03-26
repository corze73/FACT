#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not configured');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function verifyMessageReceipt() {
  try {
    console.log('🔍 Verifying message receipt to Dummy Coach...\n');

    // Find Dummy Coach user
    console.log('1️⃣  Looking for Dummy Coach user...');
    const coachResult = await sql`
      SELECT id, full_name, user_type, email
      FROM profiles
      WHERE full_name ILIKE '%dummy%coach%' OR email ILIKE '%dummy%'
      LIMIT 1
    `;

    if (coachResult.length === 0) {
      console.log('   ❌ No Dummy Coach user found');
      console.log('\n   Available coaches:');
      const coaches = await sql`
        SELECT id, full_name, email
        FROM profiles
        WHERE user_type = 'coach'
        LIMIT 5
      `;
      coaches.forEach(c => console.log(`   - ${c.full_name} (${c.email})`));
      return;
    }

    const coach = coachResult[0];
    console.log(`   ✅ Found: ${coach.full_name}`);
    console.log(`      ID: ${coach.id}`);
    console.log(`      Email: ${coach.email}`);
    console.log(`      Type: ${coach.user_type}\n`);

    // Get recent messages to/from Dummy Coach
    console.log('2️⃣  Fetching recent messages to/from Dummy Coach...');
    const messages = await sql`
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.is_read,
        m.created_date,
        sender.full_name as sender_name,
        receiver.full_name as receiver_name
      FROM messages m
      LEFT JOIN profiles sender ON m.sender_id = sender.id
      LEFT JOIN profiles receiver ON m.receiver_id = receiver.id
      WHERE m.sender_id = ${coach.id} OR m.receiver_id = ${coach.id}
      ORDER BY m.created_date DESC
      LIMIT 10
    `;

    if (messages.length === 0) {
      console.log('   ℹ️  No messages found for Dummy Coach\n');
      return;
    }

    console.log(`   ✅ Found ${messages.length} messages\n`);

    // Display messages
    console.log('3️⃣  Recent Messages:');
    console.log('   ' + '='.repeat(100));
    messages.forEach((msg, idx) => {
      console.log(`\n   Message ${idx + 1}:`);
      console.log(`   From: ${msg.sender_name} (${msg.sender_id})`);
      console.log(`   To: ${msg.receiver_name} (${msg.receiver_id})`);
      console.log(`   Content: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
      console.log(`   Read: ${msg.is_read ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${new Date(msg.created_date).toLocaleString()}`);
    });

    console.log('\n   ' + '='.repeat(100));
    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyMessageReceipt();
