import Stripe from 'stripe';
import process from 'process';
// Use server-side DB helpers from Netlify functions (never bundle client DB into server code)
import { executeQuery, executeQueryOne } from '../../netlify/functions/lib/db.js';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const StripePaymentAPI = {
  /**
   * Create a payment intent for a booking
   */
  async createPaymentIntent(bookingData) {
    try {
      const { booking_id, amount, currency = 'gbp', admin_fee = 0 } = bookingData;
      
      // Get booking details (server-side)
      const booking = await executeQueryOne(
        'SELECT * FROM bookings WHERE id = $1',
        [booking_id]
      );
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, // Amount in pence/cents
        currency: currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          booking_id: booking_id,
          admin_fee: admin_fee.toString(),
          service_type: booking.service_type,
          coach_amount: (amount - admin_fee).toString()
        },
        // Hold the payment for manual capture after session completion
        capture_method: 'manual'
      });

      // Create payment record in database
      await executeQuery(
        `INSERT INTO payments (
           booking_id, amount, currency, status, payment_method, transaction_id, admin_fee, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          booking_id,
          amount / 100, // store in pounds
          currency,
          'pending',
          'stripe',
          paymentIntent.id,
          admin_fee / 100
        ]
      );

      return {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  /**
   * Confirm payment and update booking status
   */
  async confirmPayment(bookingId, paymentIntentId) {
    try {
      // Update booking status to confirmed
      await executeQuery(
        `UPDATE bookings 
         SET status = 'confirmed', payment_status = 'authorized', updated_at = NOW()
         WHERE id = $1`,
        [bookingId]
      );

      // Update payment record
      await executeQuery(
        `UPDATE payments 
         SET status = 'authorized'
         WHERE booking_id = $1 AND transaction_id = $2`,
        [bookingId, paymentIntentId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  },

  /**
   * Capture payment after session completion (24 hours later)
   */
  async capturePayment(paymentIntentId, amountToCapture = null) {
    try {
      const captureData = {};
      if (amountToCapture) {
        captureData.amount_to_capture = amountToCapture;
      }

      const paymentIntent = await stripe.paymentIntents.capture(
        paymentIntentId,
        captureData
      );

      // Update payment record
      await executeQuery(
        `UPDATE payments 
         SET status = 'captured', released_at = NOW()
         WHERE transaction_id = $1`,
        [paymentIntentId]
      );

      return paymentIntent;
    } catch (error) {
      console.error('Error capturing payment:', error);
      throw error;
    }
  },

  /**
   * Refund payment with specific logic based on who didn't show up
   */
  async refundPayment(paymentIntentId, refundType = 'full', reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason: reason
      };

      // Get payment details to calculate refund amount
      const payment = await executeQuery(
        `SELECT p.*, b.service_price, b.admin_fee, b.total_price
         FROM payments p
         JOIN bookings b ON p.booking_id = b.id
         WHERE p.transaction_id = $1`,
        [paymentIntentId]
      );

      if (!payment || payment.length === 0) {
        throw new Error('Payment not found');
      }

      const paymentRecord = payment[0];
      let refundAmount;
      let refundDescription;

      switch (refundType) {
        case 'coach_no_show':
          // Client gets full refund (service price + admin fee)
          refundAmount = Math.round(paymentRecord.total_price * 100); // Full amount in pence
          refundDescription = 'Full refund - Coach no-show';
          break;
          
        case 'client_no_show':
          // No refund to client, coach gets paid via capture
          refundAmount = 0;
          refundDescription = 'No refund - Client no-show';
          break;
          
        case 'dispute_client_favor':
          // Client gets full refund
          refundAmount = Math.round(paymentRecord.total_price * 100);
          refundDescription = 'Full refund - Dispute resolved in client favor';
          break;
          
        case 'dispute_split':
          // Client gets service price back, platform keeps admin fee
          refundAmount = Math.round((paymentRecord.total_price - paymentRecord.admin_fee) * 100);
          refundDescription = 'Partial refund - Dispute split decision';
          break;
          
        case 'full':
        default:
          // Full refund (default behavior)
          refundAmount = Math.round(paymentRecord.total_price * 100);
          refundDescription = 'Full refund';
          break;
      }

      if (refundAmount > 0) {
        refundData.amount = refundAmount;
        const refund = await stripe.refunds.create(refundData);

        // Update payment record
        await executeQuery(
          `UPDATE payments 
           SET status = 'refunded', 
               refunded_at = NOW(),
               refund_amount = $2,
               refund_reason = $3
           WHERE transaction_id = $1`,
          [paymentIntentId, refundAmount / 100, refundDescription]
        );

        return refund;
      } else {
        // No refund case (client no-show)
        await executeQuery(
          `UPDATE payments 
           SET refund_reason = $2
           WHERE transaction_id = $1`,
          [paymentIntentId, refundDescription]
        );

        return { message: refundDescription, amount: 0 };
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  },

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
          
        case 'charge.dispute.created':
          await this.handleChargeDispute(event.data.object);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  },

  async handlePaymentSuccess(paymentIntent) {
    const bookingId = paymentIntent.metadata.booking_id;
    
    await executeQuery(
      `UPDATE bookings 
       SET status = 'confirmed', payment_status = 'authorized', updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );
  },

  async handlePaymentFailure(paymentIntent) {
    const bookingId = paymentIntent.metadata.booking_id;
    
    await executeQuery(
      `UPDATE bookings 
       SET status = 'payment_failed', payment_status = 'failed', updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );
  },

  async handleChargeDispute(dispute) {
    // Handle Stripe disputes (different from session disputes)
    console.log('Stripe dispute created:', dispute.id);
    // Implement dispute handling logic
  }
};

// Automated payment processing functions
export const PaymentAutomation = {
  /**
   * Process payments ready for release (24 hours after session completion)
   */
  async processPaymentReleases() {
    try {
      const bookingsToRelease = await executeQuery(
        `SELECT b.id, b.payment_held_until, p.transaction_id, p.amount, p.admin_fee
         FROM bookings b
         JOIN payments p ON b.id = p.booking_id
         WHERE b.payment_status = 'pending_release'
           AND b.payment_held_until <= NOW()
           AND b.dispute_status IS NULL`
      );

      for (const booking of bookingsToRelease) {
        await this.releasePaymentToCoach(booking);
      }

      console.log(`Released ${bookingsToRelease.length} payments`);
    } catch (error) {
      console.error('Error processing payment releases:', error);
    }
  },

  async releasePaymentToCoach(booking) {
    try {
      // Capture the payment
      await StripePaymentAPI.capturePayment(booking.transaction_id);

      // Update booking status
      await executeQuery(
        `UPDATE bookings SET payment_status = 'released', updated_at = NOW() WHERE id = $1`,
        [booking.id]
      );

      // Here you would typically:
      // 1. Transfer funds to coach's Stripe Connect account
      // 2. Send email notifications
      // 3. Update coach earnings

      console.log(`Payment released for booking ${booking.id}`);
    } catch (error) {
      console.error(`Error releasing payment for booking ${booking.id}:`, error);
    }
  },

  /**
   * Process refunds and payments for no-shows or disputes
   */
  async processRefunds() {
    try {
      // Handle different scenarios based on who showed up
      const scenarios = await executeQuery(
        `SELECT 
           b.id, 
           b.dispute_status, 
           b.status,
           b.client_arrived_at,
           b.coach_arrived_at,
           b.session_start,
           b.session_date,
           b.session_time,
           p.transaction_id, 
           p.amount,
           CASE 
             WHEN b.coach_arrived_at IS NULL AND b.client_arrived_at IS NOT NULL 
                  AND NOW() > (b.session_date + b.session_time::time + INTERVAL '30 minutes') THEN 'coach_no_show'
             WHEN b.client_arrived_at IS NULL AND b.coach_arrived_at IS NOT NULL 
                  AND NOW() > (b.session_date + b.session_time::time + INTERVAL '30 minutes') THEN 'client_no_show'
             WHEN b.dispute_status = 'auto_refund' AND b.dispute_deadline <= NOW() THEN 'dispute_client_favor'
             WHEN b.status = 'cancelled' THEN 'cancelled'
             ELSE 'other'
           END as scenario
         FROM bookings b
         JOIN payments p ON b.id = p.booking_id
         WHERE (
           (b.dispute_status = 'auto_refund' AND b.dispute_deadline <= NOW()) OR
           (b.status = 'cancelled' AND b.payment_status = 'authorized') OR
           (NOW() > (b.session_date + b.session_time::time + INTERVAL '30 minutes') AND 
            (b.client_arrived_at IS NULL OR b.coach_arrived_at IS NULL) AND
            b.payment_status = 'authorized' AND b.status = 'confirmed')
         )
         AND p.status = 'authorized'`
      );

      for (const booking of scenarios) {
        try {
          switch (booking.scenario) {
            case 'coach_no_show':
              // Client gets FULL refund (service price + admin fee)
              await StripePaymentAPI.refundPayment(booking.transaction_id, 'coach_no_show');
              await executeQuery(
                `UPDATE bookings SET 
                   payment_status = 'refunded',
                   status = 'coach_no_show'
                 WHERE id = $1`,
                [booking.id]
              );
              console.log(`✅ Full refund processed for booking ${booking.id} - Coach no-show`);
              break;

            case 'client_no_show':
              // Coach gets paid (capture payment), platform keeps £3 admin fee
              await StripePaymentAPI.capturePayment(booking.transaction_id);
              await executeQuery(
                `UPDATE bookings SET 
                   payment_status = 'released',
                   status = 'client_no_show'
                 WHERE id = $1`,
                [booking.id]
              );
              console.log(`💰 Payment released to coach for booking ${booking.id} - Client no-show`);
              break;

            case 'dispute_client_favor':
              // Dispute resolved in client's favor - full refund
              await StripePaymentAPI.refundPayment(booking.transaction_id, 'dispute_client_favor');
              await executeQuery(
                `UPDATE bookings SET 
                   payment_status = 'refunded',
                   dispute_status = 'resolved_client_favor'
                 WHERE id = $1`,
                [booking.id]
              );
              console.log(`⚖️ Dispute refund processed for booking ${booking.id} - Client favor`);
              break;

            case 'cancelled':
              // Regular cancellation - full refund
              await StripePaymentAPI.refundPayment(booking.transaction_id, 'full');
              await executeQuery(
                `UPDATE bookings SET payment_status = 'refunded' WHERE id = $1`,
                [booking.id]
              );
              console.log(`🔄 Cancellation refund processed for booking ${booking.id}`);
              break;
          }
        } catch (error) {
          console.error(`❌ Error processing ${booking.scenario} for booking ${booking.id}:`, error);
        }
      }

      console.log(`📊 Processed ${scenarios.length} payment scenarios`);
    } catch (error) {
      console.error('Error processing refunds:', error);
    }
  },

  /**
   * Manual no-show processing for admin intervention
   */
  async processNoShow(bookingId, noShowType) {
    try {
      const booking = await executeQuery(
        `SELECT b.*, p.transaction_id
         FROM bookings b
         JOIN payments p ON b.id = p.booking_id
         WHERE b.id = $1`,
        [bookingId]
      );

      if (!booking || booking.length === 0) {
        throw new Error('Booking not found');
      }

      const bookingData = booking[0];

      switch (noShowType) {
        case 'coach_no_show':
          // Client gets full refund
          await StripePaymentAPI.refundPayment(bookingData.transaction_id, 'coach_no_show');
          await executeQuery(
            `UPDATE bookings SET 
               payment_status = 'refunded',
               status = 'coach_no_show'
             WHERE id = $1`,
            [bookingId]
          );
          return { success: true, message: 'Full refund processed - Coach no-show', refundAmount: 'full' };

        case 'client_no_show':
          // Coach gets paid, platform keeps admin fee
          await StripePaymentAPI.capturePayment(bookingData.transaction_id);
          await executeQuery(
            `UPDATE bookings SET 
               payment_status = 'released',
               status = 'client_no_show'
             WHERE id = $1`,
            [bookingId]
          );
          return { success: true, message: 'Payment released to coach - Client no-show', refundAmount: 0 };

        default:
          throw new Error('Invalid no-show type');
      }
    } catch (error) {
      console.error(`Error processing manual no-show for booking ${bookingId}:`, error);
      throw error;
    }
  }
};