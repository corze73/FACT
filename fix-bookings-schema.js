import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL environment variable');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  try {
    console.log('Adding missing columns to bookings table...');
    
    // Add client_notes column (for user's special requests)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_notes TEXT`;
    console.log('✅ Added client_notes column');
    
    // Add location_type column (online/in-person)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'online'`;
    console.log('✅ Added location_type column');
    
    // Add location_address column (for in-person sessions)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_address TEXT`;
    console.log('✅ Added location_address column');
    
    // Add location_notes column (additional location info)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_notes TEXT`;
    console.log('✅ Added location_notes column');
    
    // Add admin_fee column (platform fee)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_fee DECIMAL(10,2) DEFAULT 3.00`;
    console.log('✅ Added admin_fee column');
    
    // Add total_price column (price + admin_fee)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2)`;
    console.log('✅ Added total_price column');
    
    // Add session_completed_by_user column (for payment confirmation)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_completed_by_user BOOLEAN DEFAULT false`;
    console.log('✅ Added session_completed_by_user column');
    
    // Add session_completed_by_coach column (for payment confirmation)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_completed_by_coach BOOLEAN DEFAULT false`;
    console.log('✅ Added session_completed_by_coach column');
    
    // Add cancellation_reason column (for cancelled bookings)
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`;
    console.log('✅ Added cancellation_reason column');
    
    console.log('🎉 Bookings table migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();