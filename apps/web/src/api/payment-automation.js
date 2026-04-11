import cron from 'node-cron';
import { PaymentAutomation } from './stripe-payment.js';
import { db } from '../databaseClient.js';

/**
 * Payment Release Automation
 * Runs every hour to check for payments ready to be released
 */
export const startPaymentAutomation = () => {
  // Run every hour to process payment releases
  cron.schedule('0 * * * *', async () => {
    try {
      await PaymentAutomation.processPaymentReleases();
    } catch (error) {
      console.error('Payment release automation failed:', error);
    }
  });

  // Run every hour to process refunds
  cron.schedule('15 * * * *', async () => {
    try {
      await PaymentAutomation.processRefunds();
    } catch (error) {
      console.error('Refund automation failed:', error);
    }
  });

  // Run once a day to clean up old data
  cron.schedule('0 2 * * *', async () => {
    try {
      await cleanupOldData();
    } catch (error) {
      console.error('Cleanup automation failed:', error);
    }
  });
};

/**
 * Clean up old data
 */
async function cleanupOldData() {
  // Clean up old session disputes that were resolved
  await db.query(`
    DELETE FROM session_disputes 
    WHERE status IN ('resolved', 'dismissed') 
    AND created_at < NOW() - INTERVAL '90 days'
  `);

  // Archive old completed bookings
  await db.query(`
    UPDATE bookings 
    SET archived = true 
    WHERE status = 'completed' 
    AND session_end < NOW() - INTERVAL '30 days'
    AND archived = false
  `);
}

/**
 * Manual trigger functions for testing
 */
export const manualTriggers = {
  async processPaymentReleases() {
    await PaymentAutomation.processPaymentReleases();
  },

  async processRefunds() {
    await PaymentAutomation.processRefunds();
  },

  async cleanupData() {
    await cleanupOldData();
  }
};