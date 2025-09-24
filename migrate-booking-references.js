/**
 * Simple migration script to add reference codes to existing bookings
 * Uses environment variables directly for Node.js compatibility
 */

import process from 'process';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { generateBookingReference } from './src/utils/booking-reference.js';

// Load environment variables
config();

console.log('🔄 Adding reference codes to existing bookings...\n');

const runMigration = async () => {
  try {
    // Check for database URL
    const databaseUrl = process.env.VITE_DATABASE_URL;
    if (!databaseUrl) {
      console.error('❌ Missing VITE_DATABASE_URL environment variable');
      console.log('   Please ensure your .env file contains VITE_DATABASE_URL');
      process.exit(1);
    }

    // Create database connection
    const sql = neon(databaseUrl);

    // Get all bookings without reference codes
    const bookingsWithoutRef = await sql`
      SELECT id, created_at FROM bookings 
      WHERE reference_code IS NULL 
      ORDER BY created_at ASC
    `;

    console.log(`Found ${bookingsWithoutRef.length} bookings without reference codes`);

    if (bookingsWithoutRef.length === 0) {
      console.log('✅ All bookings already have reference codes!');
      return;
    }

    const usedReferences = new Set();
    let updated = 0;

    for (const booking of bookingsWithoutRef) {
      try {
        // Generate unique reference code
        let referenceCode = generateBookingReference();
        let attempts = 0;
        
        // Ensure uniqueness within this batch
        while (usedReferences.has(referenceCode) && attempts < 10) {
          referenceCode = generateBookingReference();
          attempts++;
        }

        // Double-check database for uniqueness
        const existing = await sql`
          SELECT id FROM bookings WHERE reference_code = ${referenceCode}
        `;
        
        if (existing.length > 0) {
          console.warn(`⚠️  Reference collision detected: ${referenceCode}, regenerating...`);
          referenceCode = generateBookingReference();
        }

        // Update booking with reference code
        await sql`
          UPDATE bookings 
          SET reference_code = ${referenceCode}
          WHERE id = ${booking.id}
        `;

        usedReferences.add(referenceCode);
        updated++;

        console.log(`✅ Added reference ${referenceCode} to booking ${booking.id}`);

        // Small delay to avoid overwhelming the database
        if (updated % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log(`   📊 Progress: ${updated}/${bookingsWithoutRef.length} bookings updated`);
        }

      } catch (error) {
        console.error(`❌ Failed to update booking ${booking.id}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully added reference codes to ${updated}/${bookingsWithoutRef.length} bookings!`);

    // Verify the update
    const verifyCount = await sql`
      SELECT COUNT(*) as count FROM bookings WHERE reference_code IS NOT NULL
    `;
    console.log(`📊 Total bookings with reference codes: ${verifyCount[0].count}`);

    // Show some examples
    const examples = await sql`
      SELECT reference_code, service_type, session_date FROM bookings 
      WHERE reference_code IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    console.log('\n📋 Example references created:');
    examples.forEach(booking => {
      console.log(`   ${booking.reference_code} - ${booking.service_type} (${booking.session_date})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Example reference codes that will be generated
console.log('📋 Example reference codes:');
for (let i = 0; i < 5; i++) {
  console.log(`   ${generateBookingReference()}`);
}
console.log('');

// Run the migration
runMigration().then(() => {
  console.log('\n🏁 Reference code migration complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});