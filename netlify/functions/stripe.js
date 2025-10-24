// Netlify function: Stripe endpoints (webhook + API)
// Routes mapped via netlify.toml: /stripe/* -> /.netlify/functions/stripe/:splat

import Stripe from 'stripe'
import { StripePaymentAPI } from '../../src/api/stripe-payment.js'

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
        await StripePaymentAPI.handleWebhook(evt)
        return json(200, { received: true })
      } catch (err) {
        console.error('Error handling webhook:', err)
        return json(500, { error: 'Webhook handler failed' })
      }
    }

    if (method === 'POST' && path.startsWith('/create-payment-intent')) {
      const payload = JSON.parse(event.body || '{}')
      const { booking_id, amount, currency, admin_fee } = payload
      if (!booking_id || !amount) return json(400, { error: 'Missing required fields' })
      const result = await StripePaymentAPI.createPaymentIntent({ booking_id, amount, currency, admin_fee })
      return json(200, result)
    }

    if (method === 'POST' && path.startsWith('/confirm-payment')) {
      const { booking_id, payment_intent_id } = JSON.parse(event.body || '{}')
      if (!booking_id || !payment_intent_id) return json(400, { error: 'Missing required fields' })
      const result = await StripePaymentAPI.confirmPayment(booking_id, payment_intent_id)
      return json(200, result)
    }

    if (method === 'POST' && path.startsWith('/capture-payment')) {
      const { payment_intent_id, amount_to_capture } = JSON.parse(event.body || '{}')
      if (!payment_intent_id) return json(400, { error: 'Missing payment_intent_id' })
      const result = await StripePaymentAPI.capturePayment(payment_intent_id, amount_to_capture)
      return json(200, result)
    }

    if (method === 'POST' && path.startsWith('/refund-payment')) {
      const { payment_intent_id, refund_type, reason } = JSON.parse(event.body || '{}')
      if (!payment_intent_id) return json(400, { error: 'Missing payment_intent_id' })
      const result = await StripePaymentAPI.refundPayment(payment_intent_id, refund_type, reason)
      return json(200, result)
    }

    if (method === 'POST' && path.startsWith('/process-no-show')) {
      const { booking_id, no_show_type } = JSON.parse(event.body || '{}')
      if (!booking_id || !no_show_type) return json(400, { error: 'Missing booking_id or no_show_type' })
      if (!['coach_no_show', 'client_no_show'].includes(no_show_type)) return json(400, { error: 'Invalid no_show_type' })
      const result = await StripePaymentAPI.processNoShow(booking_id, no_show_type)
      return json(200, result)
    }

    return json(404, { error: 'Not found', path })
  } catch (err) {
    console.error('Unhandled Stripe function error:', err)
    return json(500, { error: 'Internal Server Error' })
  }
}
