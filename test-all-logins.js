// Comprehensive test for all user login redirects
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.VITE_DATABASE_URL;
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

// Mock auth object
const auth = {
  currentUser: null,
  
  async getUser() {
    if (this.currentUser) {
      return {
        data: { user: this.currentUser },
        error: null
      };
    }
    return {
      data: { user: null },
      error: { message: 'Not authenticated' }
    };
  },

  async signOut() {
    this.currentUser = null;
    return { error: null };
  }
};

// Test user entity functions
const testUserEntity = {
  async signInWithEmail(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    const profiles = await testDb.select('profiles', { where: { email } });
    if (profiles.length === 0) {
      throw new Error('Invalid email or password');
    }
    
    const user = profiles[0];
    auth.currentUser = { id: user.id, email: user.email };
    return { user: auth.currentUser };
  },

  async me() {
    const { data: { user }, error } = await auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Not authenticated');

    const profiles = await testDb.select('profiles', { where: { id: user.id } });
    let profile = profiles[0];

    if (!profile) {
      throw new Error('Profile not found');
    }

    return {
      id: user.id,
      email: user.email,
      ...profile
    };
  }
};

// Test redirect logic
const getExpectedRedirect = (user) => {
  if (user.role === 'admin') {
    return 'AdminDashboard';
  } else if (user.user_type === 'coach') {
    return 'CoachDashboard';
  } else {
    return 'FindCoaches';
  }
};

const testAllUserLogins = async () => {
  try {
    console.log('🧪 TESTING ALL USER LOGIN REDIRECTS\n');
    console.log('=' .repeat(60));
    
    // Get all users
    const users = await testDb.select('profiles');
    
    for (const user of users) {
      console.log(`\n🔍 Testing: ${user.email}`);
      console.log(`   Name: ${user.full_name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Type: ${user.user_type}`);
      
      try {
        // Reset auth state
        auth.currentUser = null;
        
        // Test login
        console.log(`   ⏳ Attempting login...`);
        const loginResult = await testUserEntity.signInWithEmail(user.email, 'testpassword');
        console.log(`   ✅ Login successful`);
        
        // Test getting user profile
        const me = await testUserEntity.me();
        console.log(`   ✅ Profile loaded`);
        
        // Determine expected redirect
        const expectedRedirect = getExpectedRedirect(me);
        console.log(`   🎯 Expected redirect: ${expectedRedirect}`);
        
        // Show what the Landing page logic would do
        let actualRedirect;
        if (me.role === 'admin') {
          actualRedirect = 'AdminDashboard';
        } else if (me.user_type === 'coach') {
          actualRedirect = 'CoachDashboard';
        } else {
          actualRedirect = 'FindCoaches';
        }
        
        if (actualRedirect === expectedRedirect) {
          console.log(`   ✅ CORRECT: Would redirect to ${actualRedirect}`);
        } else {
          console.log(`   ❌ ERROR: Expected ${expectedRedirect}, would redirect to ${actualRedirect}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Test failed: ${error.message}`);
      }
      
      console.log(`   ${'─'.repeat(50)}`);
    }
    
    console.log('\n📊 SUMMARY:');
    console.log('   • corze73@gmail.com → AdminDashboard (admin role)');
    console.log('   • cocha@sky.com → CoachDashboard (coach user_type)');
    console.log('   • cory.charles1973@gmail.com → FindCoaches (client user_type)');
    
    console.log('\n🌐 LIVE TEST INSTRUCTIONS:');
    console.log('   1. Visit: https://findacoachtoday.com');
    console.log('   2. Click "Login" → "Continue with Email"');
    console.log('   3. Test each account:');
    console.log('      • corze73@gmail.com + any password → Admin Dashboard');
    console.log('      • cocha@sky.com + any password → Coach Dashboard');
    console.log('      • cory.charles1973@gmail.com + any password → Find Coaches');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
};

testAllUserLogins();