// Debug RLS with actual user IDs from database
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.VITE_DATABASE_URL;
const sql = neon(databaseUrl);

const debugRLS = async () => {
  try {
    console.log('🔍 DEBUGGING RLS POLICIES\n');
    
    // First get actual user IDs
    console.log('📋 Getting actual user IDs from database...');
    const users = await sql.query('SELECT id, email, full_name, role FROM profiles ORDER BY email');
    console.log('Users found:');
    users.forEach(user => {
      console.log(`  ${user.email} → ${user.id} (${user.role})`);
    });
    
    const adminUser = users.find(u => u.role === 'admin');
    const clientUser = users.find(u => u.role === 'user' && u.email === 'cory.charles1973@gmail.com');
    
    console.log(`\nAdmin User: ${adminUser?.email} → ${adminUser?.id}`);
    console.log(`Client User: ${clientUser?.email} → ${clientUser?.id}`);
    
    // Test 1: No user context
    console.log('\n📋 Test 1: No user context...');
    await sql.query(`SELECT set_config('app.current_user_id', '', true)`);
    const test1 = await sql.query('SELECT current_setting(\'app.current_user_id\', true) as ctx');
    console.log(`   Context: "${test1[0].ctx}"`);
    
    try {
      const profiles1 = await sql.query('SELECT email FROM profiles');
      console.log(`   ❌ SECURITY ISSUE: Got ${profiles1.length} profiles without auth`);
    } catch (error) {
      console.log(`   ✅ SECURE: ${error.message}`);
    }
    
    // Test 2: Set client user context
    if (clientUser) {
      console.log('\n📋 Test 2: Set client user context...');
      await sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [clientUser.id]);
      const test2 = await sql.query('SELECT current_setting(\'app.current_user_id\', true) as ctx');
      console.log(`   Context: "${test2[0].ctx}"`);
      
      try {
        const profiles2 = await sql.query('SELECT email FROM profiles');
        console.log(`   Client can see ${profiles2.length} profiles:`);
        profiles2.forEach(p => console.log(`     • ${p.email}`));
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Test 3: Set admin user context  
    if (adminUser) {
      console.log('\n📋 Test 3: Set admin user context...');
      await sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [adminUser.id]);
      const test3 = await sql.query('SELECT current_setting(\'app.current_user_id\', true) as ctx');
      console.log(`   Context: "${test3[0].ctx}"`);
      
      try {
        const profiles3 = await sql.query('SELECT email FROM profiles');
        console.log(`   Admin can see ${profiles3.length} profiles:`);
        profiles3.forEach(p => console.log(`     • ${p.email}`));
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Test the policy logic manually
    console.log('\n📋 Test 4: Manual policy check...');
    if (clientUser) {
      await sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [clientUser.id]);
      const policyTest = await sql.query(`
        SELECT 
          id,
          email,
          (id = current_setting('app.current_user_id', true)::uuid) as is_own_profile,
          (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) as current_user_role,
          current_setting('app.current_user_id', true) as current_setting_value
        FROM profiles
      `);
      
      console.log('   Policy evaluation:');
      policyTest.forEach(row => {
        console.log(`     ${row.email}: own=${row.is_own_profile}, user_role=${row.current_user_role}, setting=${row.current_setting_value}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
};

debugRLS();