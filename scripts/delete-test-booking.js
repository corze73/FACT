import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Please configure it before running this script.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('🧹 FACT: Locate & delete test booking for Brian Haule');

  try {
    // Find an admin to set RLS context
    const admins = await sql`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`;
    if (admins.length === 0) {
      console.error('⚠️ No admin profiles found. Cannot set RLS context.');
      process.exit(1);
    }

    const adminId = admins[0].id;
    console.log('Using admin context:', adminId);

    // Locate candidate bookings that look like the Brian Haule test booking
    const candidates = await sql`
      WITH __ctx AS (
        SELECT set_config('app.current_user_id', ${adminId}, true)
      )
      SELECT 
        b.id,
        b.reference_code,
        b.status,
        b.service_type,
        b.total_price,
        client.full_name AS client_name,
        coach.full_name  AS coach_name,
        b.created_at
      FROM bookings b
      LEFT JOIN profiles client ON client.id = b.client_id
      LEFT JOIN profiles coach  ON coach.id  = b.coach_id
      WHERE 
        b.status = 'pending'
        AND (client.full_name ILIKE '%Brian%Haule%' OR coach.full_name ILIKE '%Brian%Haule%')
      ORDER BY b.created_at DESC
      LIMIT 5;
    `;

    if (candidates.length === 0) {
      console.log('ℹ️ No matching pending bookings found for Brian Haule. Nothing to delete.');
      process.exit(0);
    }

    console.log('\nFound the following candidate bookings:');
    for (const row of candidates) {
      console.log('- ID:', row.id);
      console.log('  Ref :', row.reference_code);
      console.log('  Status:', row.status);
      console.log('  Service:', row.service_type);
      console.log('  Total :', row.total_price);
      console.log('  Client:', row.client_name);
      console.log('  Coach :', row.coach_name);
      console.log('  Created:', row.created_at);
      console.log('');
    }

    const targetId = candidates[0].id;
    console.log('➡️ Cleaning up related messages for booking ID:', targetId, '...');

    // First delete any messages tied to this booking to satisfy FK constraints
    const deletedMessages = await sql`
      WITH __ctx AS (
        SELECT set_config('app.current_user_id', ${adminId}, true)
      )
      DELETE FROM messages
      WHERE booking_id = ${targetId}
      RETURNING id;
    `;

    console.log(`   Deleted ${deletedMessages.length} related message(s).`);

    console.log('➡️ Deleting booking with ID:', targetId, '...');

    const result = await sql`
      WITH __ctx AS (
        SELECT set_config('app.current_user_id', ${adminId}, true)
      )
      DELETE FROM bookings
      WHERE id = ${targetId}
      RETURNING id, reference_code, status;
    `;

    if (result.length === 0) {
      console.log('⚠️ Delete executed but no rows returned. Booking may not have been removed.');
    } else {
      console.log('✅ Deleted booking:', result[0]);
    }

    console.log('\nDone. You may need to refresh the Admin Dashboard to see updated counts.');
  } catch (err) {
    console.error('❌ Error while deleting test booking:', err.message || err);
    process.exit(1);
  }
}

main();
