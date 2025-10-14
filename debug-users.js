import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.VITE_DATABASE_URL,
});

async function checkUsers() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Get all users with their types and roles
    const result = await client.query(`
      SELECT id, full_name, email, user_type, role, created_at
      FROM profiles
      ORDER BY created_at DESC
    `);
    
    console.log('📊 All Users in Database:');
    console.log('═══════════════════════════════════════════════════\n');
    
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.full_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   User Type: "${user.user_type}"`);
      console.log(`   Role: "${user.role}"`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });
    
    console.log('\n📈 Summary:');
    console.log('─────────────────────────────────');
    const usersByType = result.rows.reduce((acc, user) => {
      const key = user.user_type || 'null';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('User Types:');
    Object.entries(usersByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\nClient Filter Test:');
    const clients = result.rows.filter(u => 
      (u.user_type === 'client' || u.user_type === 'user') && u.role !== 'admin'
    );
    console.log(`  Would show ${clients.length} client(s):`);
    clients.forEach(c => console.log(`    - ${c.full_name} (type: "${c.user_type}")`));
    
    console.log('\nCoach Filter Test:');
    const coaches = result.rows.filter(u => 
      u.user_type === 'coach' && u.role !== 'admin'
    );
    console.log(`  Would show ${coaches.length} coach(es):`);
    coaches.forEach(c => console.log(`    - ${c.full_name}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUsers();