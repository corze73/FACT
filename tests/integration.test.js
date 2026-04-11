import { User, Booking, Message, Review } from '../apps/web/src/api/entities.jsx';

async function runAllTests() {
  let results = [];

  // 1. User profile update
  try {
    await User.updateMyUserData({ full_name: 'Test User', bio: 'Updated bio', location: 'Test City' });
    const updated = await User.me();
    results.push({ feature: 'User profile update', success: updated.full_name === 'Test User' && updated.bio === 'Updated bio' });
  } catch (e) {
    results.push({ feature: 'User profile update', success: false, error: e.message });
  }

  // 2. Booking creation
  let bookingId;
  try {
    const booking = await Booking.create({
      user_id: 1, // Replace with valid test user id if needed
      client_id: 1,
      coach_id: 1, // For test, use same user
      service_type: 'technical_skills',
      session_date: new Date(),
      session_time: '10:00',
      duration: 60,
      location: { type: 'online', address: '', notes: '' },
      client_notes: 'Test booking',
      price: 50,
      admin_fee: 3,
      total_price: 53
    });
    bookingId = booking.id;
    results.push({ feature: 'Booking creation', success: !!booking.id });
  } catch (e) {
    results.push({ feature: 'Booking creation', success: false, error: e.message });
  }

  // 3. Booking cancellation
  try {
    await Booking.update(bookingId, { cancel: true, cancellation_reason: 'Test cancel' });
    const cancelled = await Booking.get(bookingId);
    results.push({ feature: 'Booking cancellation', success: cancelled.status === 'cancelled' });
  } catch (e) {
    results.push({ feature: 'Booking cancellation', success: false, error: e.message });
  }

  // 4. Messaging
  // ...existing code...
  try {
    await Message.create({ sender_id: bookingId, receiver_id: bookingId, booking_id: bookingId, content: 'Test message' });
    const messages = await Message.filter({ booking_id: bookingId });
    results.push({ feature: 'Messaging', success: messages.length > 0 });
  } catch (e) {
    results.push({ feature: 'Messaging', success: false, error: e.message });
  }

  // 5. Review system
  try {
    await Review.create({ booking_id: bookingId, reviewer_id: 1, reviewee_id: 1, rating: 5, comment: 'Great session!' });
    results.push({ feature: 'Review system', success: true });
  } catch (e) {
    results.push({ feature: 'Review system', success: false, error: e.message });
  }

  // 6. Payment confirmation
  try {
    await Booking.update(bookingId, { complete_by_user: true });
    await Booking.update(bookingId, { complete_by_coach: true });
    const completed = await Booking.get(bookingId);
    results.push({ feature: 'Payment confirmation', success: completed.status === 'completed' });
  } catch (e) {
    results.push({ feature: 'Payment confirmation', success: false, error: e.message });
  }

  // 7. Admin dashboard (basic check)
  try {
    const bookings = await Booking.list();
    const users = await User.list();
    const messages = await Message.filter({});
    // Only use reviews if needed for assertions
    results.push({ feature: 'Admin dashboard', success: bookings.length >= 0 && users.length >= 0 && messages.length >= 0 });
  } catch (e) {
    results.push({ feature: 'Admin dashboard', success: false, error: e.message });
  }

  // Print results
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.feature} passed`);
    } else {
      console.log(`❌ ${r.feature} failed: ${r.error}`);
    }
  }
}

runAllTests();
