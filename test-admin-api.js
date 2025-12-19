import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('🧪 Testing Admin Dashboard Queries\n');

// Test 1: Can we query profiles without context?
console.log('Test 1: Query profiles WITHOUT user context...');
try {
  const profiles = await sql`SELECT COUNT(*) as count FROM profiles`;
  console.log('✅ SUCCESS: Fetched', profiles[0].count, 'profiles without context');
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 2: Can we query with admin context?
console.log('\nTest 2: Query profiles WITH admin user context...');
try {
  // First, find an admin user
  const admins = await sql`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`;
  if (admins.length === 0) {
    console.log('⚠️  No admin users found in database');
  } else {
    const adminId = admins[0].id;
    console.log('Found admin ID:', adminId);
    
    // Set context and query
    const result = await sql`
      WITH __ctx AS (SELECT set_config('app.current_user_id', ${adminId}, true))
      SELECT COUNT(*) as count FROM profiles
    `;
    console.log('✅ SUCCESS: Fetched', result[0].count, 'profiles with admin context');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 3: Query bookings
console.log('\nTest 3: Query bookings WITH admin context...');
try {
  const admins = await sql`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`;
  if (admins.length > 0) {
    const adminId = admins[0].id;
    const result = await sql`
      WITH __ctx AS (SELECT set_config('app.current_user_id', ${adminId}, true))
      SELECT COUNT(*) as count FROM bookings
    `;
    console.log('✅ SUCCESS: Fetched', result[0].count, 'bookings with admin context');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n✅ Tests complete');
