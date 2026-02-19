// Quick Setup Script - Run this to check your environment
// Usage: node check-env.js

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requiredVars = {
  server: [
    'DATABASE_URL',
    'APP_JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ],
  client: [
    'VITE_DATABASE_URL',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_GOOGLE_CLIENT_ID'
  ]
};

console.log('🔍 Checking environment variables...\n');

// Check if .env exists
const envPath = join(__dirname, '.env');
const envExamplePath = join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('✅ .env.example exists - copy it to .env and fill in your values\n');
  console.log('Run: cp .env.example .env\n');
  process.exit(1);
}

// Load .env
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

let allGood = true;

console.log('Server-side variables (for Netlify functions):');
requiredVars.server.forEach(varName => {
  const exists = envVars[varName] && envVars[varName].length > 10;
  console.log(`  ${exists ? '✅' : '❌'} ${varName}${exists ? '' : ' - MISSING'}`);
  if (!exists) allGood = false;
});

console.log('\nClient-side variables (for frontend):');
requiredVars.client.forEach(varName => {
  const exists = envVars[varName] && envVars[varName].length > 10;
  console.log(`  ${exists ? '✅' : '❌'} ${varName}${exists ? '' : ' - MISSING'}`);
  if (!exists) allGood = false;
});

if (allGood) {
  console.log('\n✅ All required environment variables are set!');
  console.log('\nYou can now run: npm run dev');
} else {
  console.log('\n❌ Some environment variables are missing.');
  console.log('\nPlease update your .env file with the missing values.');
  console.log('Check .env.example for the required format.\n');
  process.exit(1);
}
