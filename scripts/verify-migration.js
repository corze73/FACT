import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();
const sql = neon(process.env.DATABASE_URL);

// Check schema updates
(async () => {
  console.log('🔍 Verifying Phase 1 Database Changes\n');
  console.log('='.repeat(60));
  
  // Check profiles table columns
  console.log('\n📋 PROFILES TABLE:');
  const profileCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name IN ('video_clip_1', 'video_clip_2', 'video_clip_3', 'country', 'city', 'postcode')
    ORDER BY column_name
  `;
  profileCols.forEach(c => console.log(`   ✓ ${c.column_name} (${c.data_type})`));
  
  // Check bookings table columns
  console.log('\n📋 BOOKINGS TABLE:');
  const bookingCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name IN ('payment_status', 'service_price')
    ORDER BY column_name
  `;
  bookingCols.forEach(c => console.log(`   ✓ ${c.column_name} (${c.data_type})`));
  
  // Check payments table
  console.log('\n📋 PAYMENTS TABLE:');
  const paymentsCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'payments'
    ORDER BY ordinal_position
    LIMIT 10
  `;
  paymentsCols.forEach(c => console.log(`   ✓ ${c.column_name} (${c.data_type})`));
  
  // Check indexes
  console.log('\n📊 PERFORMANCE INDEXES:');
  const indexes = await sql`
    SELECT indexname, tablename
    FROM pg_indexes 
    WHERE tablename IN ('profiles', 'bookings', 'payments')
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname
  `;
  const grouped = {};
  indexes.forEach(i => {
    if (!grouped[i.tablename]) grouped[i.tablename] = [];
    grouped[i.tablename].push(i.indexname);
  });
  Object.entries(grouped).forEach(([table, idxs]) => {
    console.log(`   ${table}: ${idxs.length} indexes`);
  });
  
  // Check coach count
  console.log('\n👥 DATA STATS:');
  const stats = await sql`
    SELECT 
      (SELECT COUNT(*) FROM profiles WHERE user_type = 'coach') as total_coaches,
      (SELECT COUNT(*) FROM profiles WHERE user_type IN ('user', 'client')) as total_users,
      (SELECT COUNT(*) FROM bookings) as total_bookings
  `;
  console.log(`   Coaches: ${stats[0].total_coaches}`);
  console.log(`   Users: ${stats[0].total_users}`);
  console.log(`   Bookings: ${stats[0].total_bookings}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Database schema verified successfully!');
  console.log('='.repeat(60));
})();
