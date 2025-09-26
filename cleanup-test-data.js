/* eslint-env node */
/* eslint-disable no-undef */
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const sql = neon(process.env.VITE_DATABASE_URL, {
  disableWarningInBrowsers: true
});

async function cleanupTestData() {
  try {
    console.log('🧹 Starting cleanup of test data...\n');

    // First, let's see what we have
    console.log('📊 Current data before cleanup:');
    
    const profiles = await sql`SELECT id, email, full_name, user_type, role FROM profiles ORDER BY created_at`;
    console.log(`👥 Users: ${profiles.length}`);
    profiles.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.full_name} (${p.email}) - ${p.user_type}/${p.role}`);
    });

    const bookings = await sql`SELECT id, reference_code, service_type, status FROM bookings ORDER BY created_at`;
    console.log(`\n📅 Bookings: ${bookings.length}`);
    bookings.forEach((b, i) => {
      console.log(`  ${i+1}. ${b.reference_code} - ${b.service_type} (${b.status})`);
    });

    // Check for related data
    const messages = await sql`SELECT COUNT(*) as count FROM messages`;
    const payments = await sql`SELECT COUNT(*) as count FROM payments`;
    const disputes = await sql`SELECT COUNT(*) as count FROM session_disputes`;
    
    console.log(`\n📊 Related data:`);
    console.log(`💬 Messages: ${messages[0].count}`);
    console.log(`💰 Payments: ${payments[0].count}`);
    console.log(`⚖️ Disputes: ${disputes[0].count}`);

    console.log('\n⚠️  Ready to clean up test data (keeping admin account)?');
    console.log('This will DELETE:');
    console.log('- Test user profiles (keeping corze73@gmail.com)');
    console.log('- All bookings');
    console.log('- All reviews');
    console.log('- All messages');
    console.log('- All payments');
    console.log('- All disputes');
    console.log('\nIf you want to proceed, run: node cleanup-test-data.js --confirm');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

async function executeCleanup() {
  try {
    console.log('🧹 EXECUTING CLEANUP - Keeping admin account (corze73@gmail.com)!\n');

    const adminEmail = 'corze73@gmail.com';
    
    // Get admin profile to keep
    const adminProfile = await sql`SELECT id FROM profiles WHERE email = ${adminEmail}`;
    const adminId = adminProfile[0]?.id;
    
    if (!adminId) {
      console.log('❌ Admin account not found! Stopping cleanup.');
      return;
    }
    
    console.log(`✅ Preserving admin account: ${adminEmail} (ID: ${adminId})\n`);

    // Delete in correct order due to foreign key constraints
    console.log('1. Deleting session disputes...');
    const deletedDisputes = await sql`DELETE FROM session_disputes RETURNING id`;
    console.log(`   Deleted ${deletedDisputes.length} disputes`);
    
    console.log('2. Deleting payments...');
    const deletedPayments = await sql`DELETE FROM payments RETURNING id`;
    console.log(`   Deleted ${deletedPayments.length} payments`);
    
    console.log('3. Deleting reviews...');
    const deletedReviews = await sql`DELETE FROM reviews RETURNING id`;
    console.log(`   Deleted ${deletedReviews.length} reviews`);
    
    console.log('4. Deleting messages...');
    const deletedMessages = await sql`DELETE FROM messages RETURNING id`;
    console.log(`   Deleted ${deletedMessages.length} messages`);
    
    console.log('5. Deleting bookings...');
    const deletedBookings = await sql`DELETE FROM bookings RETURNING id, reference_code`;
    console.log(`   Deleted ${deletedBookings.length} bookings`);
    deletedBookings.forEach(b => {
      console.log(`     - ${b.reference_code}`);
    });
    
    console.log('6. Deleting test profiles (keeping admin)...');
    const deletedProfiles = await sql`DELETE FROM profiles WHERE email != ${adminEmail} RETURNING id, full_name, email`;
    console.log(`   Deleted ${deletedProfiles.length} test profiles`);
    deletedProfiles.forEach(p => {
      console.log(`     - ${p.full_name} (${p.email})`);
    });

    console.log('\n✅ Test data cleanup completed!');
    console.log(`✅ Admin account preserved: ${adminEmail}`);
    console.log('🚀 Your site is now ready for live users.');
    
    // Verify cleanup
    const finalProfiles = await sql`SELECT id, email, full_name, role FROM profiles`;
    const finalBookings = await sql`SELECT COUNT(*) as count FROM bookings`;
    
    console.log('\n📊 Final verification:');
    console.log(`👥 Users remaining: ${finalProfiles.length}`);
    finalProfiles.forEach(p => {
      console.log(`   - ${p.full_name} (${p.email}) - ${p.role}`);
    });
    console.log(`📅 Bookings remaining: ${finalBookings[0].count}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup execution:', error);
  }
}

// Check if --confirm flag is provided
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  executeCleanup();
} else {
  cleanupTestData();
}