import express from 'express';
import { StripePaymentAPI, PaymentAutomation } from '../api/stripe-payment.js';
import Stripe from 'stripe';
import process from 'process';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Webhook endpoint - must be raw body for signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    await StripePaymentAPI.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Create payment intent endpoint
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { booking_id, amount, currency, admin_fee } = req.body;

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await StripePaymentAPI.createPaymentIntent({
      booking_id,
      amount,
      currency,
      admin_fee
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment endpoint
router.post('/confirm-payment', async (req, res) => {
  try {
    const { booking_id, payment_intent_id } = req.body;

    if (!booking_id || !payment_intent_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await StripePaymentAPI.confirmPayment(booking_id, payment_intent_id);
    res.json(result);
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual payment capture endpoint (for admin use)
router.post('/capture-payment', async (req, res) => {
  try {
    const { payment_intent_id, amount_to_capture } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: 'Missing payment_intent_id' });
    }

    const result = await StripePaymentAPI.capturePayment(payment_intent_id, amount_to_capture);
    res.json(result);
  } catch (error) {
    console.error('Error capturing payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refund payment endpoint
router.post('/refund-payment', async (req, res) => {
  try {
    const { payment_intent_id, refund_type, reason } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: 'Missing payment_intent_id' });
    }

    const result = await StripePaymentAPI.refundPayment(payment_intent_id, refund_type, reason);
    res.json(result);
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual no-show processing endpoint (admin only)
router.post('/process-no-show', async (req, res) => {
  try {
    const { booking_id, no_show_type } = req.body;

    if (!booking_id || !no_show_type) {
      return res.status(400).json({ error: 'Missing booking_id or no_show_type' });
    }

    if (!['coach_no_show', 'client_no_show'].includes(no_show_type)) {
      return res.status(400).json({ error: 'Invalid no_show_type. Must be coach_no_show or client_no_show' });
    }

    const result = await PaymentAutomation.processNoShow(booking_id, no_show_type);
    res.json(result);
  } catch (error) {
    console.error('Error processing no-show:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;