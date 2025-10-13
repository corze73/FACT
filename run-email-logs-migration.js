#!/usr/bin/env node

// Run migration to update email_logs table
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';

dotenv.config();
const { Client } = pg;

async function runEmailLogsMigration() {
  const config = dotenv.config();
  const client = new Client({
    connectionString: config.parsed.VITE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔄 Running email_logs table update migration...\n');

    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./migrations/20251013_update_email_logs_table.sql', 'utf8');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Email logs table updated successfully!');
    console.log('📋 Added columns:');
    console.log('   • message_id VARCHAR(255) - for tracking SMTP message IDs');
    console.log('   • error_message TEXT - for storing detailed error information');
    console.log('   • updated_at TIMESTAMP - for tracking when records are modified\n');
    
    // Verify the table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'email_logs' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Current email_logs table structure:');
    tableInfo.rows.forEach(col => {
      console.log(`   • ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'nullable' : 'required'}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

runEmailLogsMigration();