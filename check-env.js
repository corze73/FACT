// Runtime/Deploy environment validator
// Usage:
//   node check-env.js
//   node check-env.js --ci

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = new Set(process.argv.slice(2));
const isCiMode = args.has('--ci');

const requiredVars = {
  server: [
    'DATABASE_URL',
    'APP_JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ],
  client: [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_GOOGLE_CLIENT_ID'
  ],
  monitoring: [
    'SENTRY_DSN_SERVER',
    'VITE_SENTRY_DSN'
  ],
  meta: [
    'APP_ENV',
    'APP_VERSION'
  ]
};

console.log('🔍 Checking environment variables...\n');

const envPath = join(__dirname, '.env');
const fromDotEnv = {};

if (!isCiMode && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      fromDotEnv[match[1]] = match[2];
    }
  });
}

const getValue = (name) => {
  if (process.env[name] && process.env[name].trim().length > 0) return process.env[name].trim();
  if (fromDotEnv[name] && fromDotEnv[name].trim().length > 0) return fromDotEnv[name].trim();
  return '';
};

const checkGroup = (title, names) => {
  let passed = true;
  console.log(`${title}:`);
  for (const name of names) {
    const value = getValue(name);
    const exists = value.length > 0;
    console.log(`  ${exists ? '✅' : '❌'} ${name}${exists ? '' : ' - MISSING'}`);
    if (!exists) passed = false;
  }
  console.log('');
  return passed;
};

if (!isCiMode && !fs.existsSync(envPath)) {
  console.log('❌ .env file not found for local validation.');
  console.log('Run: cp .env.example .env\n');
  process.exit(1);
}

let allGood = true;
allGood = checkGroup('Server-side variables (Netlify functions)', requiredVars.server) && allGood;
allGood = checkGroup('Client variables (Vite)', requiredVars.client) && allGood;
allGood = checkGroup('Monitoring variables', requiredVars.monitoring) && allGood;
allGood = checkGroup('Build/Environment metadata', requiredVars.meta) && allGood;

if (allGood) {
  console.log('✅ Environment validation passed.');
  process.exit(0);
}

console.log('❌ Environment validation failed.');
process.exit(1);
