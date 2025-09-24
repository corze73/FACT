/**
 * Script to add reference codes to existing bookings
 * Run this once to populate reference_code for existing bookings in the database
 */

import process from 'process';
import { generateBookingReference } from './src/utils/booking-reference.js';
import { db } from './src/api/supabaseClient.js';

console.log('🔄 Adding reference codes to existing bookings...\n');

const addReferenceCodes = async () => {
  try {
    // Get all bookings without reference codes
    const bookingsWithoutRef = await db.query(`
      SELECT id, created_at FROM bookings 
      WHERE reference_code IS NULL 
      ORDER BY created_at ASC
    `);

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
        
        // Ensure uniqueness
        while (usedReferences.has(referenceCode) && attempts < 10) {
          referenceCode = generateBookingReference();
          attempts++;
        }

        // Double-check database for uniqueness
        const existing = await db.select('bookings', { where: { reference_code: referenceCode } });
        if (existing.length > 0) {
          console.warn(`⚠️  Reference collision detected: ${referenceCode}, regenerating...`);
          referenceCode = generateBookingReference();
        }

        // Update booking with reference code
        await db.update('bookings', booking.id, {
          reference_code: referenceCode
        });

        usedReferences.add(referenceCode);
        updated++;

        console.log(`✅ Added reference ${referenceCode} to booking ${booking.id}`);

        // Small delay to avoid overwhelming the database
        if (updated % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`❌ Failed to update booking ${booking.id}:`, error);
      }
    }

    console.log(`\n🎉 Successfully added reference codes to ${updated} bookings!`);

    // Verify the update
    const verifyCount = await db.query(`
      SELECT COUNT(*) as count FROM bookings WHERE reference_code IS NOT NULL
    `);
    console.log(`📊 Total bookings with reference codes: ${verifyCount[0].count}`);

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

// Example reference codes that will be generated
console.log('📋 Example reference codes:');
for (let i = 0; i < 5; i++) {
  console.log(`   ${generateBookingReference()}`);
}
console.log('');

// Run the script
if (process.argv.includes('--execute')) {
  addReferenceCodes().then(() => {
    console.log('🏁 Reference code migration complete!');
    process.exit(0);
  });
} else {
  console.log('💡 Usage: node add-booking-references.js --execute');
  console.log('   This will add reference codes to all existing bookings');
}