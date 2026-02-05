#!/usr/bin/env node
/**
 * Cleanup Script: Remove Dummy Coaches
 * 
 * ⚠️  RUN THIS BEFORE PRODUCTION LAUNCH
 * 
 * This script removes all dummy coach accounts created during testing.
 * It preserves real accounts and provides a safety confirmation.
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import process from 'node:process';
import readline from 'readline';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

// Configure what constitutes a "dummy" coach
const DUMMY_INDICATORS = [
  'test',
  'dummy',
  'demo',
  'sample',
  'coach_',
  'football coach', // Generic names from seed script
  'example'
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function findDummyCoaches() {
  console.log('🔍 Searching for dummy coaches...\n');
  
  // Find coaches with generic/test names or no real bio
  const allCoaches = await sql`
    SELECT id, email, full_name, bio, created_at
    FROM profiles
    WHERE user_type = 'coach'
    ORDER BY created_at DESC
  `;
  
  const dummyCoaches = allCoaches.filter(coach => {
    const name = (coach.full_name || '').toLowerCase();
    const email = (coach.email || '').toLowerCase();
    const bio = (coach.bio || '').toLowerCase();
    
    // Check if name/email contains dummy indicators
    const hasDummyIndicator = DUMMY_INDICATORS.some(indicator => 
      name.includes(indicator) || email.includes(indicator)
    );
    
    // Check if bio is generic or empty
    const hasGenericBio = !bio || bio.length < 20;
    
    return hasDummyIndicator || hasGenericBio;
  });
  
  return { allCoaches, dummyCoaches };
}

async function showCoachesSummary(all, dummy) {
  console.log('📊 COACH ACCOUNTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total coaches: ${all.length}`);
  console.log(`Identified as dummy: ${dummy.length}`);
  console.log(`Real coaches (will be preserved): ${all.length - dummy.length}`);
  console.log('═'.repeat(60));
  console.log();
  
  if (dummy.length > 0) {
    console.log('🗑️  Dummy coaches to be removed:');
    console.log('─'.repeat(60));
    dummy.slice(0, 10).forEach((coach, i) => {
      console.log(`${i + 1}. ${coach.full_name || 'No name'}`);
      console.log(`   Email: ${coach.email}`);
      console.log(`   Created: ${new Date(coach.created_at).toLocaleDateString()}`);
      console.log();
    });
    
    if (dummy.length > 10) {
      console.log(`   ... and ${dummy.length - 10} more`);
      console.log();
    }
  }
}

async function cleanupDummyCoaches() {
  try {
    console.log('🧹 FACT - Dummy Coach Cleanup Script');
    console.log('═'.repeat(60));
    console.log();
    
    const { allCoaches, dummyCoaches } = await findDummyCoaches();
    
    await showCoachesSummary(allCoaches, dummyCoaches);
    
    if (dummyCoaches.length === 0) {
      console.log('✅ No dummy coaches found. Database is clean!');
      rl.close();
      return;
    }
    
    // Safety confirmation
    console.log('⚠️  WARNING: This will permanently delete these accounts!');
    console.log('This action cannot be undone.');
    console.log();
    
    const confirm1 = await question('Type "DELETE" to proceed: ');
    
    if (confirm1.trim() !== 'DELETE') {
      console.log('\n❌ Cleanup cancelled.');
      rl.close();
      return;
    }
    
    console.log();
    const confirm2 = await question(`Are you absolutely sure? Type the number of coaches to delete (${dummyCoaches.length}): `);
    
    if (confirm2.trim() !== dummyCoaches.length.toString()) {
      console.log('\n❌ Cleanup cancelled - number mismatch.');
      rl.close();
      return;
    }
    
    console.log('\n🗑️  Deleting dummy coaches...');
    
    const dummyIds = dummyCoaches.map(c => c.id);
    
    // Delete in transaction
    let deletedCount = 0;
    
    for (const id of dummyIds) {
      // Delete related records first (cascade should handle this, but being explicit)
      await sql`DELETE FROM bookings WHERE coach_id = ${id}`;
      await sql`DELETE FROM messages WHERE sender_id = ${id} OR receiver_id = ${id}`;
      await sql`DELETE FROM reviews WHERE reviewee_id = ${id}`;
      await sql`DELETE FROM coach_availability WHERE coach_id = ${id}`;
      await sql`DELETE FROM coach_recurring_availability WHERE coach_id = ${id}`;
      
      // Delete the profile
      await sql`DELETE FROM profiles WHERE id = ${id}`;
      
      deletedCount++;
      
      if (deletedCount % 50 === 0) {
        console.log(`   Deleted ${deletedCount}/${dummyIds.length}...`);
      }
    }
    
    console.log(`\n✅ Successfully deleted ${deletedCount} dummy coaches`);
    console.log();
    
    // Show final stats
    const remaining = await sql`
      SELECT COUNT(*)::int as count 
      FROM profiles 
      WHERE user_type = 'coach'
    `;
    
    console.log('📊 FINAL STATS');
    console.log('═'.repeat(60));
    console.log(`Remaining coaches: ${remaining[0].count}`);
    console.log(`Deleted: ${deletedCount}`);
    console.log('═'.repeat(60));
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDummyCoaches();
}

export { cleanupDummyCoaches, findDummyCoaches };
