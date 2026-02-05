#!/usr/bin/env node
/**
 * Database Migration Runner
 * Runs the Phase 1 migration with safety checks
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('🔄 FACT - Running Phase 1 Migration\n');
    console.log('=' .repeat(60));
    
    // Check database connection
    console.log('1️⃣  Testing database connection...');
    const result = await sql`SELECT version()`;
    console.log('✅ Connected to:', result[0].version.split(' ').slice(0, 2).join(' '));
    
    // Check if tables exist
    console.log('\n2️⃣  Checking existing schema...');
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log(`✅ Found ${tables.length} existing tables`);
    
    // Read migration file
    console.log('\n3️⃣  Loading migration file...');
    const migrationPath = join(__dirname, '../migrations/20260205_add_missing_columns_and_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');
    
    // Execute migration
    console.log('\n4️⃣  Executing migration...');
    console.log('⚠️  This will:');
    console.log('   - Add video_clip columns to profiles');
    console.log('   - Add country, city, postcode to profiles');
    console.log('   - Add payment_status, service_price to bookings');
    console.log('   - Create payments table');
    console.log('   - Add 12 performance indexes\n');
    
    // Split by statement separator
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      // Skip comments and empty lines
      if (statement.startsWith('--') || !statement.trim()) continue;
      
      try {
        await sql.unsafe(statement);
        console.log('✓ Executed statement');
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate')) {
          console.log('⊘ Skipped (already exists)');
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Verify changes
    console.log('\n5️⃣  Verifying changes...');
    
    // Check new columns
    const profileCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      AND column_name IN ('video_clip_1', 'country', 'city')
    `;
    console.log(`✅ Profile columns added: ${profileCols.length}/3`);
    
    const bookingCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      AND column_name IN ('payment_status', 'service_price')
    `;
    console.log(`✅ Booking columns added: ${bookingCols.length}/2`);
    
    const paymentsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payments'
      )
    `;
    console.log(`✅ Payments table created: ${paymentsTable[0].exists ? 'Yes' : 'No'}`);
    
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('profiles', 'bookings', 'payments')
      AND indexname LIKE 'idx_%'
    `;
    console.log(`✅ Performance indexes added: ${indexes.length}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Phase 1 migration complete!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Test the app locally: npm run dev');
    console.log('2. Verify pagination works: /find-coaches');
    console.log('3. Test location fields in profile pages');
    console.log('4. Run cleanup before launch: node scripts/cleanup-dummy-coaches.js');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { runMigration };
