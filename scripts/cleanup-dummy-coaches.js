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
const FORCE_DELETE = process.env.FACT_CLEANUP_FORCE === '1';
const INCLUDE_GENERIC_BIOS = process.env.FACT_CLEANUP_INCLUDE_GENERIC_BIOS === '1';

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

const SAFE_EMAIL_PATTERNS = [
  /@example\.com$/i,
  /@fact-test\.local$/i,
  /(^|[.+_-])(test|dummy|demo|sample)([.+_-]|@|$)/i,
  /^phase\d+\./i,
];

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function hasDummyIndicator(value) {
  const normalized = String(value || '').toLowerCase();
  return DUMMY_INDICATORS.some((indicator) => normalized.includes(indicator));
}

function matchesSafeEmailPattern(email) {
  return SAFE_EMAIL_PATTERNS.some((pattern) => pattern.test(String(email || '')));
}

function isClearlyDummyCoach(coach) {
  const name = String(coach.full_name || '').toLowerCase();
  const email = String(coach.email || '').toLowerCase();
  const bio = String(coach.bio || '').trim().toLowerCase();

  const emailLooksDummy = matchesSafeEmailPattern(email);
  const nameLooksDummy = hasDummyIndicator(name);
  const bioLooksDummy = bio.length > 0 && (bio.length < 20 || hasDummyIndicator(bio));

  if (emailLooksDummy) return true;
  if (nameLooksDummy && bioLooksDummy) return true;
  if (INCLUDE_GENERIC_BIOS && bio.length > 0 && bio.length < 20 && nameLooksDummy) return true;

  return false;
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
  
  const dummyCoaches = allCoaches.filter(isClearlyDummyCoach);
  
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
  let rl;

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

    if (!FORCE_DELETE) {
      rl = createReadlineInterface();
      const confirm1 = await question(rl, 'Type "DELETE" to proceed: ');
      
      if (confirm1.trim() !== 'DELETE') {
        console.log('\n❌ Cleanup cancelled.');
        return;
      }
      
      console.log();
      const confirm2 = await question(rl, `Are you absolutely sure? Type the number of coaches to delete (${dummyCoaches.length}): `);
      
      if (confirm2.trim() !== dummyCoaches.length.toString()) {
        console.log('\n❌ Cleanup cancelled - number mismatch.');
        return;
      }
    } else {
      console.log('⚠️  FORCE DELETE enabled via FACT_CLEANUP_FORCE=1.');
    }
    
    console.log('\n🗑️  Deleting dummy coaches...');
    
    const dummyIds = dummyCoaches.map(c => c.id);
    
    // Delete in transaction
    let deletedCount = 0;
    
    for (const id of dummyIds) {
      const coachBookings = await sql`
        SELECT id
        FROM bookings
        WHERE coach_id = ${id}
      `;

      const bookingIds = coachBookings.map((booking) => booking.id);

      // Delete related records first (cascade should handle this, but being explicit)
      if (bookingIds.length > 0) {
        await sql`DELETE FROM reviews WHERE booking_id = ANY(${bookingIds}::uuid[]) OR reviewee_id = ${id}`;
        await sql`DELETE FROM deleted_messages WHERE booking_id = ANY(${bookingIds}::uuid[])`;
        await sql`DELETE FROM payments WHERE booking_id = ANY(${bookingIds}::uuid[])`;
      } else {
        await sql`DELETE FROM reviews WHERE reviewee_id = ${id}`;
      }

      await sql`DELETE FROM messages WHERE sender_id = ${id} OR receiver_id = ${id}`;
      await sql`DELETE FROM coach_availability WHERE coach_id = ${id}`;
      await sql`DELETE FROM coach_recurring_availability WHERE coach_id = ${id}`;
      await sql`DELETE FROM bookings WHERE coach_id = ${id}`;
      
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
    rl?.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDummyCoaches();
}

export { cleanupDummyCoaches, findDummyCoaches };
