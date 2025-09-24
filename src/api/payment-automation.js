import cron from 'node-cron';
import { PaymentAutomation } from './stripe-payment.js';
import { db } from '../databaseClient.js';

/**
 * Payment Release Automation
 * Runs every hour to check for payments ready to be released
 */
export const startPaymentAutomation = () => {
  console.log('Starting payment automation cron jobs...');

  // Run every hour to process payment releases
  cron.schedule('0 * * * *', async () => {
    console.log('Running payment release automation...');
    try {
      await PaymentAutomation.processPaymentReleases();
    } catch (error) {
      console.error('Payment release automation failed:', error);
    }
  });

  // Run every hour to process refunds
  cron.schedule('15 * * * *', async () => {
    console.log('Running refund automation...');
    try {
      await PaymentAutomation.processRefunds();
    } catch (error) {
      console.error('Refund automation failed:', error);
    }
  });

  // Run once a day to clean up old data
  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily cleanup...');
    try {
      await cleanupOldData();
    } catch (error) {
      console.error('Cleanup automation failed:', error);
    }
  });

  console.log('Payment automation cron jobs started successfully');
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

  console.log('Daily cleanup completed');
}

/**
 * Manual trigger functions for testing
 */
export const manualTriggers = {
  async processPaymentReleases() {
    console.log('Manually triggering payment releases...');
    await PaymentAutomation.processPaymentReleases();
  },

  async processRefunds() {
    console.log('Manually triggering refunds...');
    await PaymentAutomation.processRefunds();
  },

  async cleanupData() {
    console.log('Manually triggering cleanup...');
    await cleanupOldData();
  }
};