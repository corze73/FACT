#!/usr/bin/env node

// Verify Google Analytics data against actual user registrations
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;

async function verifyAnalyticsData() {
  const config = dotenv.config();
  const client = new Client({
    connectionString: config.parsed.VITE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Verifying Google Analytics Data Against Database...\n');

    // Get all registered users with their registration dates
    const usersResult = await client.query(`
      SELECT 
        id,
        email,
        full_name,
        user_type,
        location,
        created_at,
        DATE(created_at) as registration_date
      FROM profiles 
      ORDER BY created_at DESC
    `);

    console.log('📊 Database User Statistics:');
    console.log(`   Total Registered Users: ${usersResult.rows.length}`);
    console.log('');

    // Analyze by user type
    const usersByType = usersResult.rows.reduce((acc, user) => {
      acc[user.user_type] = (acc[user.user_type] || 0) + 1;
      return acc;
    }, {});

    console.log('👥 Users by Type:');
    Object.entries(usersByType).forEach(([type, count]) => {
      console.log(`   ${type.charAt(0).toUpperCase() + type.slice(1)}s: ${count}`);
    });
    console.log('');

    // Analyze by registration date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = usersResult.rows.filter(user => 
      new Date(user.created_at) >= thirtyDaysAgo
    );

    console.log('📅 Recent Registrations (Last 30 days):');
    console.log(`   New Users: ${recentUsers.length}`);
    
    if (recentUsers.length > 0) {
      console.log('\n   Recent Users:');
      recentUsers.forEach(user => {
        const date = new Date(user.created_at).toLocaleDateString();
        const location = user.location || 'Location not specified';
        console.log(`   • ${user.full_name} (${user.user_type}) - ${date} - ${location}`);
      });
    }
    console.log('');

    // Analyze by location (if available)
    const usersByLocation = usersResult.rows.reduce((acc, user) => {
      const location = user.location || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    console.log('🌍 Users by Location:');
    Object.entries(usersByLocation)
      .sort(([,a], [,b]) => b - a)
      .forEach(([location, count]) => {
        console.log(`   ${location}: ${count} users`);
      });
    console.log('');

    // Check authentication logs for additional insights
    const authLogsResult = await client.query(`
      SELECT 
        event_type,
        user_email,
        success,
        DATE(timestamp) as event_date,
        COUNT(*) as count
      FROM auth_logs 
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY event_type, user_email, success, DATE(timestamp)
      ORDER BY event_date DESC
    `);

    console.log('🔐 Authentication Activity (Last 30 days):');
    
    const authStats = authLogsResult.rows.reduce((acc, log) => {
      const key = `${log.event_type}_${log.success ? 'success' : 'failed'}`;
      acc[key] = (acc[key] || 0) + parseInt(log.count);
      return acc;
    }, {});

    Object.entries(authStats).forEach(([key, count]) => {
      const [event, status] = key.split('_');
      console.log(`   ${event.charAt(0).toUpperCase() + event.slice(1)} ${status}: ${count}`);
    });
    console.log('');

    // Compare with GA data from screenshot
    console.log('📈 Google Analytics Comparison:');
    console.log('   GA shows users from: United States, United Kingdom, Germany');
    console.log('   GA Active Users: 19 (Total), 20 (New), 29 (Engaged Sessions)');
    console.log('   GA Time Period: Last 28 days (Sept 16 - Oct 13, 2025)');
    console.log('');

    console.log('🔍 Verification Recommendations:');
    console.log('   1. Check if GA tracking is properly installed on all pages');
    console.log('   2. Verify GA4 measurement ID is correct in your app');
    console.log('   3. Compare registration dates with GA traffic spikes');
    console.log('   4. Consider adding UTM parameters to track traffic sources');
    console.log('');

    // Check if GA tracking is in the codebase
    console.log('🔧 Next Steps:');
    console.log('   • Database shows concrete registrations and activity');
    console.log('   • GA shows broader user engagement and browsing behavior');
    console.log('   • Both metrics are valuable for different insights');
    console.log('   • Consider adding location capture during registration for better geo-tracking');

  } catch (error) {
    console.error('❌ Error verifying analytics data:', error);
  } finally {
    await client.end();
  }
}

verifyAnalyticsData();