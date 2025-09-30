// Simple Database Test
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Testing FACT database connection...');

// Test environment variables
const dbUrl = process.env.VITE_DATABASE_URL;
console.log('Database URL configured:', !!dbUrl);

if (!dbUrl) {
  console.error('❌ VITE_DATABASE_URL not configured');
  process.exit(1);
}

// Test Neon connection
import { neon } from '@neondatabase/serverless';

const sql = neon(dbUrl);

const testConnection = async () => {
  try {
    console.log('Testing database connection...');
    
    // Test basic query
    const result = await sql`SELECT COUNT(*) as count FROM profiles`;
    console.log('✅ Database connection successful');
    console.log(`   Found ${result[0].count} profiles in database`);
    
    // Test table structure
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('\n📊 Database Tables:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    console.log('\n🎉 Database is ready for FACT app!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

testConnection();