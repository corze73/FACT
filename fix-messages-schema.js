import { neon } from '@neondatabase/serverless';

const databaseUrl = 'REDACTED_NEON_URL';
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