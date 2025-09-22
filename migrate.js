import { neon } from '@neondatabase/serverless';

const databaseUrl = 'REDACTED_NEON_URL';

const sql = neon(databaseUrl);

async function runMigration() {
  try {
    console.log('Adding service_type column to bookings table...');
    
    // Add the service_type column
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_type TEXT`;
    console.log('✅ Added service_type column');
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();