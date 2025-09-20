import { neon } from '@neondatabase/serverless';

const sql = neon('REDACTED_NEON_URL');

const testDatabase = async () => {
  try {
    console.log('Testing Neon database connection...');
    
    // Test basic connection
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✓ Database connection successful:', result[0].current_time);
    
    // Test profiles table
    const profiles = await sql`SELECT * FROM profiles`;
    console.log(`✓ Found ${profiles.length} profiles in database`);
    
    // Test specific profile lookup
    if (profiles.length > 0) {
      const profile = await sql`SELECT * FROM profiles WHERE email = 'corze73@gmail.com'`;
      console.log('✓ Admin profile lookup:', profile[0]?.full_name);
    }
    
    console.log('\n🎉 All database tests passed! Migration successful.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
};

testDatabase();