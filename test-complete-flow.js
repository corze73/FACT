// Complete App Flow Testing Script
import { User, Booking, Message } from './src/api/entities.jsx';

console.log('🚀 Starting comprehensive FACT app testing...\n');

const runTests = async () => {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const test = async (name, testFn) => {
    try {
      console.log(`Testing: ${name}...`);
      await testFn();
      console.log(`✅ ${name} - PASSED\n`);
      results.passed++;
      results.tests.push({ name, status: 'PASSED' });
    } catch (error) {
      console.error(`❌ ${name} - FAILED:`, error.message);
      console.error('Full error:', error);
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  };

  // Test 1: Database Connection
  await test('Database Connection', async () => {
    const users = await User.list();
    if (!Array.isArray(users)) throw new Error('Database connection failed');
    console.log(`   Found ${users.length} users in database`);
  });

  // Test 2: User Registration (Coach)
  await test('Coach Registration', async () => {
    const testEmail = `testcoach_${Date.now()}@example.com`;
    const coachData = {
      full_name: 'Test Coach',
      user_type: 'coach',
      location: { address: 'London, UK' },
      bio: 'Experienced football coach',
      coach_profile: {
        hourly_rate: 50,
        services_offered: ['striker', 'fitness_conditioning'],
        age_groups: ['adults', 'under_18']
      }
    };
    
    await User.signUpWithEmail(testEmail, 'password123', coachData);
    console.log(`   Coach registered with email: ${testEmail}`);
  });

  // Test 3: User Registration (Client)
  await test('Client Registration', async () => {
    const testEmail = `testclient_${Date.now()}@example.com`;
    const clientData = {
      full_name: 'Test Client',
      user_type: 'client',
      location: { address: 'Manchester, UK' },
      bio: 'Looking to improve football skills',
      preferred_coaching_types: ['striker', 'tactical_analysis']
    };
    
    await User.signUpWithEmail(testEmail, 'password123', clientData);
    console.log(`   Client registered with email: ${testEmail}`);
  });

  // Test 4: Authentication Flow
  await test('Authentication System', async () => {
    const isAuth = await User.isAuthenticated();
    console.log(`   Authentication status: ${isAuth}`);
    
    if (isAuth) {
      const currentUser = await User.me();
      console.log(`   Current user: ${currentUser.full_name} (${currentUser.user_type})`);
    }
  });

  // Test 5: Coach Filtering
  await test('Coach Discovery', async () => {
    const coaches = await User.filter({ user_type: 'coach' });
    console.log(`   Found ${coaches.length} coaches`);
    
    if (coaches.length > 0) {
      const coach = coaches[0];
      console.log(`   Sample coach: ${coach.full_name}, Rate: £${coach.coach_profile?.hourly_rate || 'N/A'}`);
    }
  });

  // Test 6: Booking System
  await test('Booking Creation', async () => {
    const coaches = await User.filter({ user_type: 'coach' });
    const clients = await User.filter({ user_type: 'client' });
    
    if (coaches.length === 0 || clients.length === 0) {
      throw new Error('Need at least 1 coach and 1 client for booking test');
    }

    const bookingData = {
      client_id: clients[0].id,
      coach_id: coaches[0].id,
      service_type: 'striker',
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
      duration_minutes: 60,
      total_amount: coaches[0].coach_profile?.hourly_rate || 50,
      status: 'pending'
    };

    const booking = await Booking.create(bookingData);
    console.log(`   Booking created: ${booking.id}`);
  });

  // Test 7: Message System
  await test('Messaging System', async () => {
    const bookings = await Booking.list();
    
    if (bookings.length === 0) {
      throw new Error('Need at least 1 booking for message test');
    }

    const messageData = {
      booking_id: bookings[0].id,
      sender_id: bookings[0].client_id,
      message_text: 'Test message for booking system',
      created_date: new Date().toISOString()
    };

    const message = await Message.create(messageData);
    console.log(`   Message created: ${message.id}`);
  });

  // Test Results Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎯 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.tests.length}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / results.tests.length) * 100)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.tests.forEach(test => {
    const status = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The app is ready for launch! 🚀');
  } else {
    console.log('\n⚠️  Some tests failed. Please review and fix before launch.');
  }
};

runTests().catch(console.error);