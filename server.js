import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.VITE_APP_URL || 'http://localhost:5173',
  credentials: true
}));

// For Stripe webhooks, we need raw body
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

// For other routes, use JSON middleware
app.use(express.json());

// Import and use Stripe routes
import('./src/api/stripe-routes.js').then(({ default: stripeRoutes }) => {
  app.use('/stripe', stripeRoutes);
}).catch(err => {
  console.error('Error loading Stripe routes:', err);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe_configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Stripe webhook: http://localhost:${PORT}/stripe/webhook`);
  console.log(`🔑 Stripe configured: ${!!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY)}`);
});

export default app;