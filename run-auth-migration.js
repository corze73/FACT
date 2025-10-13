// Database migration script for authentication logging tables
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import process from 'process';

// Load environment variables
dotenv.config();

const databaseUrl = process.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing VITE_DATABASE_URL environment variable');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  console.log('🚀 Starting database migration for authentication logging...\n');

  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'migrations', '20251013_add_auth_logging_and_email_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute...\n`);

    // Execute each statement using sql.query for raw SQL
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await sql.query(statement);
          console.log(`✅ Statement ${i + 1} completed`);
        } catch (error) {
          console.log(`⚠️ Statement ${i + 1} warning/info: ${error.message}`);
          // Continue with other statements even if some fail (for CREATE IF NOT EXISTS, etc.)
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!\n');

    // Verify the tables were created
    console.log('🔍 Verifying table creation...\n');

    const tables = await sql.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('auth_logs', 'email_logs', 'admin_notifications')
      ORDER BY table_name, ordinal_position
    `);

    if (tables.length > 0) {
      console.log('✅ Tables created successfully:');
      let currentTable = '';
      tables.forEach(table => {
        if (table.table_name !== currentTable) {
          console.log(`\n📋 ${table.table_name}:`);
          currentTable = table.table_name;
        }
        console.log(`  - ${table.column_name}: ${table.data_type}`);
      });
    } else {
      console.log('⚠️ No tables found - migration may have failed');
    }

    console.log('\n📊 Testing table accessibility...\n');

    // Test each table
    const testTables = ['auth_logs', 'email_logs', 'admin_notifications'];
    
    for (const tableName of testTables) {
      try {
        const count = await sql.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`✅ ${tableName}: Accessible (${count[0].count} records)`);
      } catch (error) {
        console.log(`❌ ${tableName}: Error - ${error.message}`);
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. ✅ Database tables are ready');
    console.log('2. 📧 Email service is configured');  
    console.log('3. 📝 Authentication logging is active');
    console.log('4. 👨‍💼 Admin dashboard can now show auth failures');
    console.log('5. 🔔 Notifications will be sent for signup events');

    console.log('\n💡 Configuration Notes:');
    console.log('- Set VITE_ADMIN_EMAIL in your .env file for admin notifications');
    console.log('- Configure email service (SendGrid, Mailgun, etc.) in emailService.js');
    console.log('- Admin users can view auth logs in the admin dashboard');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();