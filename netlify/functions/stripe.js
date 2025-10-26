// Netlify function: Stripe endpoints (webhook + API)
// Routes mapped via netlify.toml: /stripe/* -> /.netlify/functions/stripe/:splat

import Stripe from 'stripe'
import { executeQuery, executeQueryOne } from './lib/db.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = {
  // Ensure we can read raw body for webhook verification
  // Netlify automatically provides body as base64 if needed
  // We handle decoding below.
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

export async function handler(event) {
  const method = event.httpMethod
  const path = (event.path || '').replace(/^.*\/stripe/, '') || '/'

  console.log('[Stripe Function] Invoked:', { method, path, rawPath: event.path })

  try {
    if (method === 'POST' && path.startsWith('/webhook')) {
      const sig = event.headers['stripe-signature']
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body

      let evt
      try {
        evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message)
        return json(400, { error: `Webhook Error: ${err.message}` })
      }

      try {
        // Handle webhook events inline
        switch (evt.type) {
          case 'payment_intent.succeeded': {
            const successIntent = evt.data.object;
            const successBookingId = successIntent.metadata.booking_id;
            if (successBookingId) {
              await executeQuery(
                `UPDATE bookings 
                 SET status = 'confirmed', payment_status = 'authorized', updated_at = NOW()
                 WHERE id = $1`,
                [successBookingId]
              );
            }
            break;
          }
          
          case 'payment_intent.payment_failed': {
            const failedIntent = evt.data.object;
            const failedBookingId = failedIntent.metadata.booking_id;
            if (failedBookingId) {
              await executeQuery(
                `UPDATE bookings 
                 SET status = 'payment_failed', payment_status = 'failed', updated_at = NOW()
                 WHERE id = $1`,
                [failedBookingId]
              );
            }
            break;
          }
            
          default:
            console.log(`Unhandled event type: ${evt.type}`);
        }
        return json(200, { received: true })
      } catch (err) {
        console.error('Error handling webhook:', err)
        return json(500, { error: 'Webhook handler failed' })
      }
    }

    if (method === 'POST' && path.startsWith('/create-payment-intent')) {
      console.log('[Stripe] create-payment-intent invoked');
      const payload = JSON.parse(event.body || '{}')
      const { booking_id, amount, currency = 'gbp', admin_fee = 0 } = payload
      if (!booking_id || !amount) return json(400, { error: 'Missing required fields' })
      
      // Get booking details
      const booking = await executeQueryOne(
        'SELECT * FROM bookings WHERE id = $1',
        [booking_id]
      );
      if (!booking) {
        return json(404, { error: 'Booking not found' });
      }
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
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
        capture_method: 'manual'
      });

      // Create payment record
      await executeQuery(
        `INSERT INTO payments (
           booking_id, amount, currency, status, payment_method, transaction_id, admin_fee, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          booking_id,
          amount / 100,
          currency,
          'pending',
          'stripe',
          paymentIntent.id,
          admin_fee / 100
        ]
      );

      return json(200, {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      })
    }

    if (method === 'POST' && path.startsWith('/confirm-payment')) {
      const { booking_id, payment_intent_id } = JSON.parse(event.body || '{}')
      if (!booking_id || !payment_intent_id) return json(400, { error: 'Missing required fields' })
      
      // Update booking status
      await executeQuery(
        `UPDATE bookings 
         SET status = 'confirmed', payment_status = 'authorized', updated_at = NOW()
         WHERE id = $1`,
        [booking_id]
      );

      // Update payment record
      await executeQuery(
        `UPDATE payments 
         SET status = 'authorized'
         WHERE booking_id = $1 AND transaction_id = $2`,
        [booking_id, payment_intent_id]
      );
      
      return json(200, { success: true })
    }

    if (method === 'POST' && path.startsWith('/capture-payment')) {
      const { payment_intent_id, amount_to_capture } = JSON.parse(event.body || '{}')
      if (!payment_intent_id) return json(400, { error: 'Missing payment_intent_id' })
      
      const captureData = amount_to_capture ? { amount_to_capture } : {};
      const paymentIntent = await stripe.paymentIntents.capture(
        payment_intent_id,
        captureData
      );

      await executeQuery(
        `UPDATE payments 
         SET status = 'captured', released_at = NOW()
         WHERE transaction_id = $1`,
        [payment_intent_id]
      );
      
      return json(200, paymentIntent)
    }

    if (method === 'POST' && path.startsWith('/refund-payment')) {
      const { payment_intent_id, refund_type = 'full', reason = 'requested_by_customer' } = JSON.parse(event.body || '{}')
      if (!payment_intent_id) return json(400, { error: 'Missing payment_intent_id' })
      
      const payment = await executeQuery(
        `SELECT p.*, b.service_price, b.admin_fee, b.total_price
         FROM payments p
         JOIN bookings b ON p.booking_id = b.id
         WHERE p.transaction_id = $1`,
        [payment_intent_id]
      );

      if (!payment || payment.length === 0) {
        return json(404, { error: 'Payment not found' });
      }

      const paymentRecord = payment[0];
      let refundAmount = 0;
      let refundDescription = 'Full refund';

      switch (refund_type) {
        case 'coach_no_show':
          refundAmount = Math.round(paymentRecord.total_price * 100);
          refundDescription = 'Full refund - Coach no-show';
          break;
        case 'client_no_show':
          refundAmount = 0;
          refundDescription = 'No refund - Client no-show';
          break;
        case 'dispute_client_favor':
          refundAmount = Math.round(paymentRecord.total_price * 100);
          refundDescription = 'Full refund - Dispute resolved in client favor';
          break;
        case 'dispute_split':
          refundAmount = Math.round((paymentRecord.total_price - paymentRecord.admin_fee) * 100);
          refundDescription = 'Partial refund - Dispute split decision';
          break;
        default:
          refundAmount = Math.round(paymentRecord.total_price * 100);
          break;
      }

      if (refundAmount > 0) {
        const refund = await stripe.refunds.create({
          payment_intent: payment_intent_id,
          amount: refundAmount,
          reason: reason
        });

        await executeQuery(
          `UPDATE payments 
           SET status = 'refunded', 
               refunded_at = NOW(),
               refund_amount = $2,
               refund_reason = $3
           WHERE transaction_id = $1`,
          [payment_intent_id, refundAmount / 100, refundDescription]
        );

        return json(200, refund);
      } else {
        await executeQuery(
          `UPDATE payments 
           SET refund_reason = $2
           WHERE transaction_id = $1`,
          [payment_intent_id, refundDescription]
        );

        return json(200, { message: refundDescription, amount: 0 });
      }
    }

    if (method === 'POST' && path.startsWith('/process-no-show')) {
      const { booking_id, no_show_type } = JSON.parse(event.body || '{}')
      if (!booking_id || !no_show_type) return json(400, { error: 'Missing booking_id or no_show_type' })
      if (!['coach_no_show', 'client_no_show'].includes(no_show_type)) return json(400, { error: 'Invalid no_show_type' })
      
      const booking = await executeQuery(
        `SELECT b.*, p.transaction_id
         FROM bookings b
         JOIN payments p ON b.id = p.booking_id
         WHERE b.id = $1`,
        [booking_id]
      );

      if (!booking || booking.length === 0) {
        return json(404, { error: 'Booking not found' });
      }

      const bookingData = booking[0];

      if (no_show_type === 'coach_no_show') {
        // Refund logic would go here using stripe.refunds.create
        await executeQuery(
          `UPDATE bookings SET 
             payment_status = 'refunded',
             status = 'coach_no_show'
           WHERE id = $1`,
          [booking_id]
        );
        return json(200, { success: true, message: 'Full refund processed - Coach no-show', refundAmount: 'full' });
      } else {
        // Capture payment for coach
        await stripe.paymentIntents.capture(bookingData.transaction_id);
        await executeQuery(
          `UPDATE bookings SET 
             payment_status = 'released',
             status = 'client_no_show'
           WHERE id = $1`,
          [booking_id]
        );
        return json(200, { success: true, message: 'Payment released to coach - Client no-show', refundAmount: 0 });
      }
    }

    return json(404, { error: 'Not found', path, method, hint: 'Valid routes: /webhook, /create-payment-intent, /confirm-payment, /capture-payment, /refund-payment, /process-no-show' })
  } catch (err) {
    console.error('Unhandled Stripe function error:', err)
    return json(500, { error: 'Internal Server Error', message: err.message })
  }
}
