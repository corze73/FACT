// Check RLS status on all tables
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.VITE_DATABASE_URL;
const sql = neon(databaseUrl);

const checkRLS = async () => {
  try {
    console.log('🔍 CHECKING ROW LEVEL SECURITY (RLS) STATUS\n');
    console.log('=' .repeat(60));
    
    // Get all tables and their RLS status
    const rlsQuery = `
      SELECT 
        tablename,
        rowsecurity as rls_enabled,
        CASE 
          WHEN rowsecurity THEN 'ENABLED'
          ELSE 'DISABLED'
        END as rls_status
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    
    const tables = await sql.query(rlsQuery, []);
    
    console.log('📊 TABLE RLS STATUS:');
    console.log('─'.repeat(40));
    tables.forEach(table => {
      const status = table.rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`   ${table.tablename.padEnd(20)} ${status}`);
    });
    
    // Check for existing RLS policies
    console.log('\n🔒 EXISTING RLS POLICIES:');
    console.log('─'.repeat(40));
    
    const policiesQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;
    
    const policies = await sql.query(policiesQuery, []);
    
    if (policies.length === 0) {
      console.log('   No RLS policies found');
    } else {
      policies.forEach(policy => {
        console.log(`   Table: ${policy.tablename}`);
        console.log(`   Policy: ${policy.policyname}`);
        console.log(`   Command: ${policy.cmd}`);
        console.log(`   ─────────────────────`);
      });
    }
    
    // Summary and recommendations
    console.log('\n📋 ANALYSIS:');
    const disabledTables = tables.filter(t => !t.rls_enabled);
    
    if (disabledTables.length > 0) {
      console.log('   ⚠️  RLS is DISABLED on these tables:');
      disabledTables.forEach(table => {
        console.log(`      • ${table.tablename}`);
      });
      
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   For a production app, you should consider enabling RLS on:');
      console.log('   • profiles (user data protection)');
      console.log('   • bookings (user privacy)');
      console.log('   • messages (private communications)');
      console.log('   • reviews (prevent unauthorized modifications)');
      
      console.log('\n⚠️  CURRENT SECURITY LEVEL:');
      console.log('   Without RLS, all authenticated users can access all data');
      console.log('   This might be OK for demo/development but not production');
    } else {
      console.log('   ✅ All tables have RLS enabled');
    }
    
  } catch (error) {
    console.error('❌ Error checking RLS:', error.message);
  }
};

checkRLS();