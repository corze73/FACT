import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();
const sql = neon(process.env.VITE_DATABASE_URL);

async function createUITestData() {
  try {
    console.log('🎨 Creating UI Test Data...');
    
    // Get existing users for UI testing
    const existingUsers = await sql`SELECT id, email, full_name FROM profiles LIMIT 3`;
    const client = existingUsers[0]; // This will be our client
    const coach = existingUsers[1];  // This will be our coach
    const admin = existingUsers[2];  // This will be our admin
    
    console.log('👥 Test users for UI testing:');
    console.log(`   🧑‍💼 Client: ${client.email}`);
    console.log(`   🏃‍♂️ Coach: ${coach.email}`);
    console.log(`   👨‍💼 Admin: ${admin.email}`);
    
    // Create a fresh booking for UI testing in different states
    const confirmedBooking = await sql`
      INSERT INTO bookings (
        client_id, coach_id, service_type, booking_date,
        duration, location, total_price, status, payment_status
      )
      VALUES (
        ${client.id}, ${coach.id}, 'personal_training',
        '2025-09-25 15:00:00+00', 1, 'online', 75.00, 'confirmed', 'pending'
      )
      RETURNING id, status
    `;
    
    // Create an arrived booking (client arrived, waiting for coach)
    const arrivedBooking = await sql`
      INSERT INTO bookings (
        client_id, coach_id, service_type, booking_date,
        duration, location, total_price, status, payment_status,
        client_arrived_at
      )
      VALUES (
        ${client.id}, ${coach.id}, 'fitness_coaching',
        '2025-09-25 16:00:00+00', 1, 'gym', 80.00, 'confirmed', 'pending',
        NOW() - INTERVAL '5 minutes'
      )
      RETURNING id, status
    `;
    
    // Create an in-session booking (both arrived, session started)
    const inSessionBooking = await sql`
      INSERT INTO bookings (
        client_id, coach_id, service_type, booking_date,
        duration, location, total_price, status, payment_status,
        client_arrived_at, coach_arrived_at, session_started_at
      )
      VALUES (
        ${client.id}, ${coach.id}, 'nutrition_guidance',
        '2025-09-25 17:00:00+00', 2, 'online', 120.00, 'confirmed', 'pending',
        NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '25 minutes'
      )
      RETURNING id, status
    `;
    
    // Create a near-completion booking (client completed, waiting for coach)
    const nearCompleteBooking = await sql`
      INSERT INTO bookings (
        client_id, coach_id, service_type, booking_date,
        duration, location, total_price, status, payment_status,
        client_arrived_at, coach_arrived_at, session_started_at, client_completed_at
      )
      VALUES (
        ${client.id}, ${coach.id}, 'lifestyle_coaching',
        '2025-09-25 18:00:00+00', 1, 'park', 60.00, 'confirmed', 'pending',
        NOW() - INTERVAL '70 minutes', NOW() - INTERVAL '65 minutes', 
        NOW() - INTERVAL '65 minutes', NOW() - INTERVAL '5 minutes'
      )
      RETURNING id, status
    `;
    
    console.log('📅 Test bookings created for UI testing:');
    console.log(`   ✅ Confirmed booking: ${confirmedBooking[0].id} (ready for arrival)`);
    console.log(`   ⏳ Arrival pending: ${arrivedBooking[0].id} (client arrived, waiting for coach)`);
    console.log(`   🎯 In session: ${inSessionBooking[0].id} (both arrived, session active)`);
    console.log(`   🏁 Near complete: ${nearCompleteBooking[0].id} (client completed, waiting for coach)`);
    
    console.log('\n🌐 UI Testing Instructions:');
    console.log('   1. Navigate to: http://localhost:5174');
    console.log('   2. Login with any of the test user emails above');
    console.log('   3. Go to "My Bookings" page to see SessionStatus components');
    console.log('   4. Test the arrival and completion buttons');
    console.log('   5. Try early completion with reason');
    console.log('   6. Test dispute creation');
    
    console.log('\n🎮 Component Test Scenarios:');
    console.log('   📍 Arrival Testing: Click "Mark Arrival" on confirmed booking');
    console.log('   ⭐ Completion Testing: Complete sessions on in-progress bookings');
    console.log('   ⚡ Early Completion: Complete sessions before scheduled end time');
    console.log('   ⚠️  Dispute Testing: Report issues on active/completed sessions');
    console.log('   💰 Payment Tracking: Watch payment status changes in real-time');
    
  } catch (error) {
    console.error('❌ Error creating UI test data:', error.message);
  }
}

createUITestData();