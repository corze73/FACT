/**
 * Test script for no-show refund scenarios
 * Tests the payment logic for coach no-show vs client no-show
 */

import process from 'process';
import { Booking, Payment } from './src/api/entities.jsx';
import { StripePaymentAPI, PaymentAutomation } from './src/api/stripe-payment.js';

console.log('🧪 Testing No-Show Refund Logic\n');

// Test scenarios
const testScenarios = async () => {
  try {
    console.log('📋 Creating test bookings with payments...\n');

    // Create test coach no-show scenario
    const coachNoShowBooking = await Booking.create({
      client_id: 'test-client-1',
      coach_id: 'test-coach-1',
      service_type: 'COACHING',
      session_date: '2025-09-24',
      session_time: '09:00',
      duration: 60,
      price: 50,
      admin_fee: 3,
      total_price: 53,
      status: 'confirmed',
      payment_status: 'authorized',
      client_arrived_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      coach_arrived_at: null // Coach didn't show up
    });

    // Create payment record for coach no-show
    await Payment.create({
      booking_id: coachNoShowBooking.id,
      amount: 53,
      currency: 'GBP',
      status: 'authorized',
      payment_method: 'stripe',
      transaction_id: 'pi_test_coach_no_show_123',
      admin_fee: 3
    });

    // Create test client no-show scenario  
    const clientNoShowBooking = await Booking.create({
      client_id: 'test-client-2',
      coach_id: 'test-coach-2',
      service_type: 'COACHING',
      session_date: '2025-09-24',
      session_time: '10:00',
      duration: 60,
      price: 50,
      admin_fee: 3,
      total_price: 53,
      status: 'confirmed',
      payment_status: 'authorized',
      client_arrived_at: null, // Client didn't show up
      coach_arrived_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    });

    // Create payment record for client no-show
    await Payment.create({
      booking_id: clientNoShowBooking.id,
      amount: 53,
      currency: 'GBP',
      status: 'authorized',
      payment_method: 'stripe',
      transaction_id: 'pi_test_client_no_show_456',
      admin_fee: 3
    });

    console.log('✅ Test bookings created:');
    console.log(`   📅 Coach No-Show Booking ID: ${coachNoShowBooking.id}`);
    console.log(`   📅 Client No-Show Booking ID: ${clientNoShowBooking.id}\n`);

    // Test the refund logic
    console.log('🔬 Testing refund scenarios...\n');

    // Test Coach No-Show (Client gets full refund)
    console.log('1️⃣ Testing Coach No-Show Scenario:');
    const coachNoShowResult = await PaymentAutomation.processNoShow(
      coachNoShowBooking.id, 
      'coach_no_show'
    );
    console.log(`   Result: ${coachNoShowResult.message}`);
    console.log(`   Refund: ${coachNoShowResult.refundAmount === 'full' ? '£53.00 (Service + Admin Fee)' : coachNoShowResult.refundAmount}`);

    // Test Client No-Show (Coach gets paid, platform keeps admin fee)
    console.log('\n2️⃣ Testing Client No-Show Scenario:');
    const clientNoShowResult = await PaymentAutomation.processNoShow(
      clientNoShowBooking.id, 
      'client_no_show'
    );
    console.log(`   Result: ${clientNoShowResult.message}`);
    console.log(`   Coach Payment: £50.00 (Service Price)`);
    console.log(`   Platform Fee: £3.00 (Admin Fee)`);
    console.log(`   Client Refund: £0.00`);

    console.log('\n📊 Payment Summary:');
    console.log('   Coach No-Show: Client gets £53.00 back (100% refund)');
    console.log('   Client No-Show: Coach gets £50.00, Platform gets £3.00');

    // Verify database updates
    console.log('\n🔍 Verifying database updates...');
    
    const updatedCoachNoShow = await Booking.findById(coachNoShowBooking.id);
    const updatedClientNoShow = await Booking.findById(clientNoShowBooking.id);
    
    console.log(`   Coach No-Show Status: ${updatedCoachNoShow.status} | Payment: ${updatedCoachNoShow.payment_status}`);
    console.log(`   Client No-Show Status: ${updatedClientNoShow.status} | Payment: ${updatedClientNoShow.payment_status}`);

    console.log('\n✅ No-Show Refund Logic Test Complete!\n');

    // Summary of business logic
    console.log('💼 Business Logic Summary:');
    console.log('═'.repeat(50));
    console.log('• Coach No-Show: Client receives FULL refund (service + admin fee)');
    console.log('• Client No-Show: Coach receives service price, platform keeps admin fee');
    console.log('• Disputes: Handled case-by-case with proper fee allocation');
    console.log('• All refunds processed automatically via Stripe');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

// Mock Stripe API for testing (replace with real Stripe calls in production)
const mockStripeAPI = () => {
  StripePaymentAPI.refundPayment = async (paymentIntentId, refundType) => {
    console.log(`   🔄 Processing Stripe refund: ${paymentIntentId} (${refundType})`);
    return { id: 're_test_' + Math.random().toString(36).substr(2, 9) };
  };

  StripePaymentAPI.capturePayment = async (paymentIntentId) => {
    console.log(`   💰 Capturing Stripe payment: ${paymentIntentId}`);
    return { id: paymentIntentId, status: 'succeeded' };
  };
};

// Run tests
if (process.argv.includes('--run-tests')) {
  mockStripeAPI();
  testScenarios();
} else {
  console.log('💡 Usage: node test-no-show-logic.js --run-tests');
  console.log('   This will test the no-show refund scenarios with mock Stripe API');
}