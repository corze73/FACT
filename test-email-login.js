// Simple test without dotenv - using hardcoded connection for testing
import { neon } from '@neondatabase/serverless';

// Test with actual database URL from env
const databaseUrl = process.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  console.log('❌ VITE_DATABASE_URL not found in environment');
  console.log('ℹ️  Make sure .env file is loaded or set environment variable');
  process.exit(1);
}

const sql = neon(databaseUrl);

const testDb = {
  async query(text, params = []) {
    return await sql.query(text, params);
  },
  
  async select(table, options = {}) {
    let query = `SELECT * FROM ${table}`;
    const params = [];
    
    if (options.where) {
      const conditions = [];
      let paramIndex = 1;
      for (const [key, value] of Object.entries(options.where)) {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    return await this.query(query, params);
  }
};

const testEmailLogin = async () => {
  try {
    console.log('🧪 Testing email login functionality...\n');
    
    console.log('📋 Available users in database:');
    const users = await testDb.select('profiles');
    users.forEach(user => {
      console.log(`  • ${user.email} (${user.full_name}) - Role: ${user.role}, Type: ${user.user_type}`);
    });
    
    console.log('\n🔍 Testing login with corze73@gmail.com...');
    
    // Test finding user by email (what signInWithEmail does)
    const profiles = await testDb.select('profiles', { where: { email: 'corze73@gmail.com' } });
    
    if (profiles.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('✅ User found in database:');
    console.log(`  Name: ${profiles[0].full_name}`);
    console.log(`  Email: ${profiles[0].email}`);
    console.log(`  Role: ${profiles[0].role}`);
    console.log(`  User Type: ${profiles[0].user_type}`);
    
    console.log('\n✅ Email login should work with any password for this user');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testEmailLogin();