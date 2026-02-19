import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Checking .env configuration:\n');

const checks = [
  { name: 'DATABASE_URL', value: process.env.DATABASE_URL, shouldStart: 'postgresql://', required: true },
  { name: 'APP_JWT_SECRET', value: process.env.APP_JWT_SECRET, shouldStart: null, required: true },
  { name: 'VITE_DATABASE_URL', value: process.env.VITE_DATABASE_URL, shouldStart: 'postgresql://', required: false },
  { name: 'STRIPE_SECRET_KEY', value: process.env.STRIPE_SECRET_KEY, shouldStart: 'sk_', required: true },
  { name: 'VITE_STRIPE_PUBLISHABLE_KEY', value: process.env.VITE_STRIPE_PUBLISHABLE_KEY, shouldStart: 'pk_', required: true },
  { name: 'STRIPE_WEBHOOK_SECRET', value: process.env.STRIPE_WEBHOOK_SECRET, shouldStart: 'whsec_', required: true },
  { name: 'VITE_GOOGLE_CLIENT_ID', value: process.env.VITE_GOOGLE_CLIENT_ID, shouldStart: null, required: true }
];

let hasErrors = false;

checks.forEach(check => {
  const value = check.value;
  
  if (!value || value.trim() === '') {
    if (check.required) {
      console.log('❌', check.name, '- MISSING (required)');
      hasErrors = true;
    } else {
      console.log('⚠️ ', check.name, '- Optional, not set');
    }
  } else if (value.includes('user:password') || value.includes('your-') || value.includes('...') || value === 'postgresql://user:password@host/database?sslmode=require') {
    console.log('⚠️ ', check.name, '- Still has PLACEHOLDER value (needs real credentials)');
    hasErrors = true;
  } else if (check.shouldStart && !value.startsWith(check.shouldStart)) {
    console.log('❌', check.name, `- Wrong format (should start with "${check.shouldStart}")`);
    console.log('   Currently starts with:', value.substring(0, 15) + '...');
    hasErrors = true;
  } else {
    const preview = value.length > 30 ? value.substring(0, 20) + '...' + value.substring(value.length - 10) : value;
    console.log('✅', check.name, '- Configured correctly');
  }
});

console.log('\n' + (hasErrors ? '❌ Some issues found - please fix the values marked above' : '✅ All required variables are configured!'));
process.exit(hasErrors ? 1 : 0);
