// Test registration functionality
import { User } from './src/api/entities.jsx';

const testRegistration = async () => {
  console.log('Testing registration functionality...');
  
  try {
    // Test coach registration
    const coachData = {
      full_name: 'Test Coach',
      user_type: 'coach',
      location: { address: 'London, UK' },
      bio: 'Experienced football coach',
      coach_profile: {
        hourly_rate: 50,
        services_offered: ['striker', 'fitness_conditioning'],
        age_groups: ['adults', 'under_18']
      }
    };
    
    console.log('Attempting coach registration...');
    await User.signUpWithEmail('testcoach@example.com', 'password123', coachData);
    console.log('✅ Coach registration successful!');
    
    // Test client registration
    const clientData = {
      full_name: 'Test Client',
      user_type: 'client',
      location: { address: 'Manchester, UK' },
      bio: 'Looking to improve my football skills',
      preferred_coaching_types: ['striker', 'tactical_analysis']
    };
    
    console.log('Attempting client registration...');
    await User.signUpWithEmail('testclient@example.com', 'password123', clientData);
    console.log('✅ Client registration successful!');
    
  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    console.error('Full error:', error);
  }
};

// Run the test
testRegistration();