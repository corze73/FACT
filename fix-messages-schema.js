/* eslint-env node */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load env vars from .env if present
dotenv.config();

const databaseUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL environment variable');
  console.error('   Please set DATABASE_URL in your environment (server-side only).');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  try {
    console.log('Adding booking_id column to messages table...');
    await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id)`;
    console.log('✅ Added booking_id column to messages table');
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();