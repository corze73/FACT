import Stripe from 'stripe';
import process from 'process';
import { db } from '../databaseClient.js';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const StripePaymentAPI = {
  /**
   * Create a payment intent for a booking
   */
  async createPaymentIntent(bookingData) {
    try {
      const { booking_id, amount, currency = 'gbp', admin_fee = 0 } = bookingData;
      
      // Get booking details
      const booking = await db.select('bookings', { where: { id: booking_id } });
      if (!booking.length) {
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
          service_type: booking[0].service_type,
          coach_amount: (amount - admin_fee).toString()
        },
        // Hold the payment for manual capture after session completion
        capture_method: 'manual'
      });

      // Create payment record in database
      await db.insert('payments', {
        booking_id: booking_id,
        amount: amount / 100, // Convert back to pounds
        currency: currency,
        status: 'pending',
        payment_method: 'stripe',
        transaction_id: paymentIntent.id,
        admin_fee: admin_fee / 100,
        created_at: new Date().toISOString()
      });

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
      await db.update('bookings', bookingId, {
        status: 'confirmed',
        payment_status: 'authorized'
      });

      // Update payment record
      await db.query(`
        UPDATE payments 
        SET status = 'authorized' 
        WHERE booking_id = $1 AND transaction_id = $2
      `, [bookingId, paymentIntentId]);

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
      await db.query(`
        UPDATE payments 
        SET status = 'captured', released_at = NOW()
        WHERE transaction_id = $1
      `, [paymentIntentId]);

      return paymentIntent;
    } catch (error) {
      console.error('Error capturing payment:', error);
      throw error;
    }
  },

  /**
   * Refund payment (if coach doesn't show or dispute resolved in client favor)
   */
  async refundPayment(paymentIntentId, refundAmount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason: reason
      };

      if (refundAmount) {
        refundData.amount = refundAmount;
      }

      const refund = await stripe.refunds.create(refundData);

      // Update payment record
      await db.query(`
        UPDATE payments 
        SET status = 'refunded', refunded_at = NOW()
        WHERE transaction_id = $1
      `, [paymentIntentId]);

      return refund;
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
    
    await db.update('bookings', bookingId, {
      status: 'confirmed',
      payment_status: 'authorized'
    });
  },

  async handlePaymentFailure(paymentIntent) {
    const bookingId = paymentIntent.metadata.booking_id;
    
    await db.update('bookings', bookingId, {
      status: 'payment_failed',
      payment_status: 'failed'
    });
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
      const bookingsToRelease = await db.query(`
        SELECT b.id, b.payment_held_until, p.transaction_id, p.amount, p.admin_fee
        FROM bookings b
        JOIN payments p ON b.id = p.booking_id
        WHERE b.payment_status = 'pending_release'
        AND b.payment_held_until <= NOW()
        AND b.dispute_status IS NULL
      `);

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
      await db.update('bookings', booking.id, {
        payment_status: 'released'
      });

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
   * Process refunds for no-shows or disputes
   */
  async processRefunds() {
    try {
      const bookingsToRefund = await db.query(`
        SELECT b.id, b.dispute_status, p.transaction_id, p.amount
        FROM bookings b
        JOIN payments p ON b.id = p.booking_id
        WHERE (
          (b.dispute_status = 'auto_refund' AND b.dispute_deadline <= NOW()) OR
          (b.status = 'cancelled' AND b.payment_status = 'authorized')
        )
        AND p.status = 'authorized'
      `);

      for (const booking of bookingsToRefund) {
        await StripePaymentAPI.refundPayment(booking.transaction_id);
        await db.update('bookings', booking.id, {
          payment_status: 'refunded'
        });
      }

      console.log(`Processed ${bookingsToRefund.length} refunds`);
    } catch (error) {
      console.error('Error processing refunds:', error);
    }
  }
};