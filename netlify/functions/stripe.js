// Netlify function: Stripe endpoints (webhook + API)
// Routes mapped via netlify.toml: /stripe/* -> /.netlify/functions/stripe/:splat

import Stripe from 'stripe'
import { executeQuery, executeQueryOne } from './lib/db.js'
import { getAuthContext } from './lib/auth.js'
import { rateLimitMiddleware, RATE_LIMITS } from './lib/rateLimiter.js'
import { withFunctionObservability, captureFunctionError } from './lib/observability.js'
import { calculateCancellationPolicy } from './lib/paymentPolicy.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ---------- Stripe mode guard ----------
// Derive the actual mode from the key prefix (sk_test_ vs sk_live_).
// STRIPE_MODE env var must be set to 'test' or 'live' in each Netlify context.
// If they disagree, all payment operations are blocked to prevent accidental
// real charges in a beta / preview environment.
const _stripeKey = process.env.STRIPE_SECRET_KEY || ''
const _detectedMode = _stripeKey.startsWith('sk_live_') ? 'live'
  : _stripeKey.startsWith('sk_test_') ? 'test'
  : 'unknown'
const _expectedMode = (process.env.STRIPE_MODE || '').toLowerCase() // 'test' | 'live'
const _modeMismatch = !!(_expectedMode && _expectedMode !== _detectedMode)

if (_modeMismatch) {
  console.error(
    `[Stripe] ENVIRONMENT MISMATCH: STRIPE_MODE="${_expectedMode}" but ` +
    `STRIPE_SECRET_KEY prefix indicates "${_detectedMode}". ` +
    'All payment operations will be blocked to prevent accidental live charges. ' +
    'Fix by setting matching STRIPE_MODE and STRIPE_SECRET_KEY in this Netlify context.'
  )
} else {
  console.log(`[Stripe] Initialised in "${_detectedMode}" mode.`)
}
// ---------- end mode guard ----------

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

const rawHandler = async (event) => {
  const method = event.httpMethod
  const path = (event.path || '').replace(/^.*\/stripe/, '') || '/'

  console.log('[Stripe Function] Invoked:', { method, path, rawPath: event.path })

  // Apply rate limiting (skip for webhooks as they come from Stripe)
  if (!path.startsWith('/webhook')) {
    const headers = { 'Content-Type': 'application/json' };
    const rateLimitResponse = rateLimitMiddleware(event, headers, RATE_LIMITS.mutation);
    if (rateLimitResponse) return rateLimitResponse;
  }

  try {
    // Block all non-webhook payment operations when STRIPE_MODE is mismatched.
    // Webhooks are exempt because they originate from Stripe itself and carry
    // their own signature; blocking them would break event handling.
    if (_modeMismatch && !path.startsWith('/webhook')) {
      return json(503, {
        error: 'Stripe environment mismatch — payments blocked.',
        detail: `STRIPE_MODE="${_expectedMode}" but key is "${_detectedMode}". ` +
          'Set matching STRIPE_MODE and STRIPE_SECRET_KEY in the Netlify environment.'
      })
    }

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
                 SET status = 'confirmed', payment_status = 'captured', updated_at = NOW()
                 WHERE id = $1 AND status <> 'cancelled'`,
                [successBookingId]
              );
              await executeQuery(
                `UPDATE payments SET status = 'captured', stripe_charge_id = $2, updated_at = NOW()
                 WHERE transaction_id = $1`,
                [successIntent.id, successIntent.latest_charge || null]
              );
            }
            break;
          }

          case 'payment_intent.canceled': {
            const canceledIntent = evt.data.object;
            await executeQuery(
              `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE transaction_id = $1`,
              [canceledIntent.id]
            );
            break;
          }

          case 'charge.refunded': {
            const charge = evt.data.object;
            if (charge.payment_intent) {
              await executeQuery(
                `UPDATE payments SET status = 'refunded', refunded_at = COALESCE(refunded_at, NOW()),
                   refund_amount = $2, updated_at = NOW() WHERE transaction_id = $1`,
                [charge.payment_intent, Number(charge.amount_refunded || 0) / 100]
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
                 SET payment_status = 'failed', updated_at = NOW()
                 WHERE id = $1 AND status = 'pending'
                   AND payment_status NOT IN ('captured', 'released', 'refunded')`,
                [failedBookingId]
              );
              await executeQuery(
                `UPDATE payments SET status = 'failed', updated_at = NOW()
                 WHERE transaction_id = $1 AND status IN ('pending', 'authorized', 'failed')`,
                [failedIntent.id]
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

    // ---- Authentication ----
    // Resolve auth once here for all non-webhook routes.
    // Webhook route is handled above and returns early before reaching this point.
    const authCtx = await getAuthContext(event)
    if (!authCtx.userId) {
      return json(401, { error: 'Authentication required' })
    }
    // ---- End Authentication ----

    if (method === 'POST' && path.startsWith('/connect/onboard')) {
      if (authCtx.userType !== 'coach') return json(403, { error: 'Coach account required' })
      const { return_url, refresh_url } = JSON.parse(event.body || '{}')
      const configuredBase = process.env.APP_BASE_URL || 'https://findacoachtoday.com'
      const requestOrigin = String(event.headers?.origin || '')
      const originIsAllowed = requestOrigin === 'https://findacoachtoday.com' ||
        requestOrigin === 'https://www.findacoachtoday.com' ||
        /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(requestOrigin) ||
        (process.env.NETLIFY_DEV === 'true' && /^http:\/\/localhost:\d+$/.test(requestOrigin))
      const appBase = originIsAllowed ? requestOrigin : configuredBase
      const safeReturn = String(return_url || `${appBase}/coachprofile`)
      const safeRefresh = String(refresh_url || `${appBase}/coachprofile`)
      if (!safeReturn.startsWith(appBase) || !safeRefresh.startsWith(appBase)) {
        return json(400, { error: 'Invalid Connect return URL' })
      }

      const profile = await executeQueryOne(
        'SELECT email, stripe_connect_account_id FROM profiles WHERE id = $1',
        [authCtx.userId]
      )
      let accountId = profile?.stripe_connect_account_id
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'GB',
          email: profile?.email || undefined,
          capabilities: { transfers: { requested: true } },
          metadata: { fact_coach_id: authCtx.userId }
        })
        accountId = account.id
        await executeQuery(
          'UPDATE profiles SET stripe_connect_account_id = $2, updated_at = NOW() WHERE id = $1',
          [authCtx.userId, accountId]
        )
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: safeRefresh,
        return_url: safeReturn,
        type: 'account_onboarding'
      })
      return json(200, { url: link.url })
    }

    if (method === 'GET' && path.startsWith('/connect/status')) {
      if (authCtx.userType !== 'coach') return json(403, { error: 'Coach account required' })
      const profile = await executeQueryOne(
        'SELECT stripe_connect_account_id, coach_penalty_balance, coach_no_show_strikes FROM profiles WHERE id = $1',
        [authCtx.userId]
      )
      if (!profile?.stripe_connect_account_id) {
        return json(200, { connected: false, onboarding_complete: false })
      }
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)
      const complete = Boolean(account.details_submitted && account.payouts_enabled)
      await executeQuery(
        `UPDATE profiles SET stripe_connect_onboarding_complete = $2,
           stripe_connect_charges_enabled = $3, stripe_connect_payouts_enabled = $4,
           updated_at = NOW() WHERE id = $1`,
        [authCtx.userId, complete, Boolean(account.charges_enabled), Boolean(account.payouts_enabled)]
      )
      return json(200, {
        connected: true,
        onboarding_complete: complete,
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        penalty_balance: Number(profile.coach_penalty_balance || 0),
        no_show_strikes: Number(profile.coach_no_show_strikes || 0)
      })
    }

    if (method === 'POST' && path.startsWith('/cancel-booking')) {
      const { booking_id, reason } = JSON.parse(event.body || '{}')
      if (!booking_id || String(reason || '').trim().length < 3) {
        return json(400, { error: 'Booking and cancellation reason are required' })
      }
      const record = await executeQueryOne(
        `SELECT b.*, p.id AS payment_id, p.transaction_id, p.status AS stripe_payment_status,
                COALESCE(p.refund_amount, 0) AS prior_refund_amount
         FROM bookings b LEFT JOIN LATERAL (
           SELECT * FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1
         ) p ON true WHERE b.id = $1`,
        [booking_id]
      )
      if (!record) return json(404, { error: 'Booking not found' })
      const isClient = record.client_id === authCtx.userId
      const isCoach = record.coach_id === authCtx.userId
      if (!authCtx.isAdmin && !isClient && !isCoach) return json(403, { error: 'Not permitted to cancel this booking' })
      if (!['pending', 'confirmed'].includes(record.status)) return json(409, { error: 'This booking can no longer be cancelled' })

      const actor = authCtx.isAdmin ? 'admin' : (isCoach ? 'coach' : 'client')
      const sessionAt = new Date(record.booking_date)
      const hoursUntil = (sessionAt.getTime() - Date.now()) / 3600000
      const totalPence = Math.round(Number(record.total_price || 0) * 100)
      const servicePence = Math.round(Number(record.service_price || (Number(record.total_price) - Number(record.admin_fee))) * 100)
      let refundPence = 0
      let refundDescription = 'No payment refund due'

      if (record.transaction_id && record.stripe_payment_status === 'captured') {
        const policy = calculateCancellationPolicy({ actor, hoursUntil, totalPence, servicePence })
        refundPence = policy.refundPence
        refundDescription = policy.description

        if (refundPence > 0) {
          await stripe.refunds.create({
            payment_intent: record.transaction_id,
            amount: refundPence,
            reason: 'requested_by_customer',
            metadata: { booking_id, cancelled_by: actor }
          }, { idempotencyKey: `booking-${booking_id}-${actor}-cancellation-refund` })
          await executeQuery(
            `UPDATE payments SET refund_amount = $2, refund_reason = $3, refunded_at = NOW(),
               status = CASE WHEN $2 >= amount THEN 'refunded' ELSE status END, updated_at = NOW()
             WHERE id = $1`,
            [record.payment_id, refundPence / 100, refundDescription]
          )
        } else {
          await executeQuery('UPDATE payments SET refund_reason = $2, updated_at = NOW() WHERE id = $1', [record.payment_id, refundDescription])
        }
      }

      if (actor === 'coach' && record.status === 'confirmed' && hoursUntil < 48) {
        await executeQuery(
          `UPDATE profiles SET coach_penalty_balance = coach_penalty_balance + 3, updated_at = NOW() WHERE id = $1`,
          [record.coach_id]
        )
      }

      const retainedCoachPence = actor === 'client' ? Math.max(0, servicePence - refundPence) : 0
      const eligibleAt = retainedCoachPence > 0 ? sessionAt : null
      const updated = await executeQueryOne(
        `UPDATE bookings SET status = 'cancelled', cancelled_by = $2, cancellation_reason = $3,
           payout_eligible_at = $4,
           payment_status = CASE WHEN $5 >= ROUND(total_price * 100) THEN 'refunded' ELSE payment_status END,
           updated_at = NOW() WHERE id = $1 RETURNING *`,
        [booking_id, actor, String(reason).trim(), eligibleAt, refundPence]
      )
      return json(200, { ...updated, refund_amount: refundPence / 100, refund_policy: refundDescription })
    }

    if (method === 'POST' && path.startsWith('/release-coach-payout')) {
      if (!authCtx.isAdmin) return json(403, { error: 'Admin access required' })
      const { booking_id } = JSON.parse(event.body || '{}')
      const record = await executeQueryOne(
        `SELECT b.*, p.id AS payment_id, p.stripe_charge_id, p.stripe_transfer_id,
                COALESCE(p.refund_amount, 0) AS refund_amount,
                c.stripe_connect_account_id, c.stripe_connect_payouts_enabled,
                c.coach_penalty_balance
         FROM bookings b JOIN payments p ON p.booking_id = b.id
         JOIN profiles c ON c.id = b.coach_id WHERE b.id = $1`,
        [booking_id]
      )
      if (!record) return json(404, { error: 'Booking payment not found' })
      if (record.stripe_transfer_id) return json(200, { success: true, already_released: true })
      const releasableStatus = record.status === 'completed' || (record.status === 'cancelled' && record.cancelled_by === 'client')
      if (!releasableStatus || record.dispute_status === 'open' || !record.payout_eligible_at || new Date(record.payout_eligible_at) > new Date()) {
        return json(409, { error: 'Payout is not yet eligible' })
      }
      if (!record.stripe_connect_account_id || !record.stripe_connect_payouts_enabled) {
        return json(409, { error: 'Coach Stripe payout account is not ready' })
      }
      const coachAmount = Math.max(0, Math.round((Number(record.total_price) - Number(record.admin_fee) - Number(record.refund_amount || 0)) * 100))
      if (coachAmount <= 0) return json(409, { error: 'There is no coach balance to release' })
      const penalty = Math.min(coachAmount, Math.round(Number(record.coach_penalty_balance || 0) * 100))
      const transfer = await stripe.transfers.create({
        amount: coachAmount - penalty,
        currency: 'gbp',
        destination: record.stripe_connect_account_id,
        source_transaction: record.stripe_charge_id || undefined,
        transfer_group: `booking-${record.id}`,
        metadata: { booking_id: record.id }
      }, { idempotencyKey: `booking-${record.id}-coach-payout` })
      await executeQuery(
        `UPDATE payments SET status = 'released', stripe_transfer_id = $2,
           transferred_at = NOW(), released_at = NOW() WHERE id = $1`,
        [record.payment_id, transfer.id]
      )
      await executeQuery(
        `UPDATE bookings SET payment_status = 'released', updated_at = NOW() WHERE id = $1`,
        [record.id]
      )
      if (penalty > 0) {
        await executeQuery(
          'UPDATE profiles SET coach_penalty_balance = GREATEST(0, coach_penalty_balance - $2) WHERE id = $1',
          [record.coach_id, penalty / 100]
        )
      }
      return json(200, { success: true, transfer_id: transfer.id, amount: (coachAmount - penalty) / 100 })
    }

    if (method === 'POST' && path.startsWith('/create-payment-intent')) {
      console.log('[Stripe] create-payment-intent invoked');
      const payload = JSON.parse(event.body || '{}')
      const { booking_id } = payload
      if (!booking_id) return json(400, { error: 'Missing booking_id' })
      
      // Get booking details
      const booking = await executeQueryOne(
        'SELECT * FROM bookings WHERE id = $1',
        [booking_id]
      );
      if (!booking) {
        return json(404, { error: 'Booking not found' });
      }
      if (!authCtx.isAdmin && booking.client_id !== authCtx.userId) {
        return json(403, { error: 'Only the booking client can authorize payment' })
      }
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return json(409, { error: 'Booking is not eligible for payment' })
      }

      const amount = Math.round(Number(booking.total_price) * 100)
      const admin_fee = Math.round(Number(booking.admin_fee) * 100)
      const currency = 'gbp'
      if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(admin_fee) || admin_fee < 0 || admin_fee >= amount) {
        return json(409, { error: 'Booking has invalid server-side pricing' })
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
        capture_method: 'automatic_async'
      }, { idempotencyKey: `booking-${booking_id}-authorization` });

      // Stripe returns the same intent for an idempotent retry. Older production
      // schemas may not yet have a UNIQUE constraint on transaction_id, so avoid
      // relying on ON CONFLICT here.
      const existingPayment = await executeQueryOne(
        'SELECT id FROM payments WHERE transaction_id = $1 LIMIT 1',
        [paymentIntent.id]
      );
      if (!existingPayment) {
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
      }

      return json(200, {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      })
    }

    if (method === 'POST' && path.startsWith('/confirm-payment')) {
      const { booking_id, payment_intent_id } = JSON.parse(event.body || '{}')
      if (!booking_id || !payment_intent_id) return json(400, { error: 'Missing required fields' })

      const booking = await executeQueryOne('SELECT * FROM bookings WHERE id = $1', [booking_id])
      if (!booking) return json(404, { error: 'Booking not found' })
      if (!authCtx.isAdmin && booking.client_id !== authCtx.userId) {
        return json(403, { error: 'Only the booking client can confirm payment' })
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id)
      const expectedAmount = Math.round(Number(booking.total_price) * 100)
      if (
        paymentIntent.metadata?.booking_id !== booking_id ||
        paymentIntent.amount !== expectedAmount ||
        paymentIntent.currency !== 'gbp' ||
        paymentIntent.status !== 'succeeded'
      ) {
        return json(409, { error: 'Stripe payment does not match this booking' })
      }
      
      // Update booking status
      await executeQuery(
        `UPDATE bookings 
         SET status = 'confirmed', payment_status = 'captured', updated_at = NOW()
         WHERE id = $1`,
        [booking_id]
      );

      // Update payment record
      await executeQuery(
        `UPDATE payments 
         SET status = 'captured', stripe_charge_id = $3
         WHERE booking_id = $1 AND transaction_id = $2`,
        [booking_id, payment_intent_id, paymentIntent.latest_charge || null]
      );
      
      return json(200, { success: true, payment_status: 'captured' })
    }

    if (method === 'POST' && path.startsWith('/capture-payment')) {
      if (!authCtx.isAdmin) return json(403, { error: 'Admin access required' })
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
      if (!authCtx.isAdmin) return json(403, { error: 'Admin access required' })
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
      if (!authCtx.isAdmin) return json(403, { error: 'Admin access required' })
      const { booking_id, no_show_type } = JSON.parse(event.body || '{}')
      if (!booking_id || !no_show_type) return json(400, { error: 'Missing booking_id or no_show_type' })
      if (!['coach_no_show', 'client_no_show'].includes(no_show_type)) return json(400, { error: 'Invalid no_show_type' })
      
      const booking = await executeQuery(
        `SELECT b.*, p.transaction_id, p.status AS stripe_payment_status
         FROM bookings b
         JOIN LATERAL (SELECT * FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) p ON true
         WHERE b.id = $1`,
        [booking_id]
      );

      if (!booking || booking.length === 0) {
        return json(404, { error: 'Booking not found' });
      }

      const bookingData = booking[0];
      if (bookingData.status !== 'confirmed' || bookingData.stripe_payment_status !== 'captured') {
        return json(409, { error: 'Only a paid, confirmed booking can be marked as a no-show' })
      }
      if (new Date(bookingData.booking_date) > new Date()) {
        return json(409, { error: 'A no-show cannot be recorded before the scheduled session time' })
      }

      if (no_show_type === 'coach_no_show') {
        const intent = await stripe.paymentIntents.retrieve(bookingData.transaction_id)
        if (intent.status === 'requires_capture') {
          await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: 'requested_by_customer' })
        } else if (intent.status === 'succeeded') {
          await stripe.refunds.create(
            { payment_intent: intent.id, reason: 'requested_by_customer', metadata: { booking_id } },
            { idempotencyKey: `booking-${booking_id}-coach-no-show-refund` }
          )
        }
        await executeQuery(
          `UPDATE payments SET status = 'refunded', refunded_at = NOW(),
             refund_amount = amount, refund_reason = 'Full refund - Coach no-show'
           WHERE transaction_id = $1`,
          [bookingData.transaction_id]
        )
        await executeQuery(
          `UPDATE profiles SET coach_penalty_balance = coach_penalty_balance + 3,
             coach_no_show_strikes = coach_no_show_strikes + 1,
             is_active = CASE WHEN coach_no_show_strikes + 1 >= 3 THEN false ELSE is_active END,
             updated_at = NOW() WHERE id = $1`,
          [bookingData.coach_id]
        )
        await executeQuery(
          `UPDATE bookings SET 
             payment_status = 'refunded',
             status = 'cancelled', cancellation_reason = 'Coach no-show', updated_at = NOW()
           WHERE id = $1`,
          [booking_id]
        );
        return json(200, { success: true, message: 'Full refund processed; £3 coach penalty recorded', refundAmount: 'full' });
      } else {
        await executeQuery(
          `UPDATE bookings SET 
             status = 'completed', completed_at = NOW(), payout_eligible_at = NOW(),
             cancellation_reason = 'Client no-show', updated_at = NOW()
           WHERE id = $1`,
          [booking_id]
        );
        return json(200, { success: true, message: 'Client no-show recorded; coach payout is eligible', refundAmount: 0 });
      }
    }

    return json(404, { error: 'Not found', path, method, hint: 'Valid routes: /webhook, /connect/onboard, /connect/status, /create-payment-intent, /confirm-payment, /cancel-booking, /release-coach-payout, /refund-payment, /process-no-show' })
  } catch (err) {
    captureFunctionError(err, {
      route: 'stripe',
      method: event.httpMethod,
      path: event.path
    })
    console.error('Unhandled Stripe function error:', err)
    return json(500, { error: 'Internal Server Error', message: err.message })
  }
}

export const handler = withFunctionObservability('stripe', rawHandler)
