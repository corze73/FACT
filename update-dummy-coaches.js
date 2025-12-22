import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

const serviceTypes = ['goalkeeping', 'defense', 'midfield', 'striker', 'fitness_conditioning', 'tactical_analysis'];
const ageGroups = ['youth', 'adults', 'seniors'];

async function updateDummyCoaches() {
  try {
    console.log('🔄 Updating dummy coaches with coach_profile data...');
    
    // Get all coaches without coach_profile
    const coaches = await sql`
      SELECT id, full_name 
      FROM profiles 
      WHERE user_type = 'coach' 
      AND coach_profile IS NULL
    `;
    
    console.log(`Found ${coaches.length} coaches to update`);
    
    let updated = 0;
    for (const coach of coaches) {
      // Randomly assign 2-3 service types
      const numServices = Math.floor(Math.random() * 2) + 2; // 2-3 services
      const services = [];
      const shuffled = [...serviceTypes].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numServices; i++) {
        services.push(shuffled[i]);
      }
      
      // Randomly assign 1-2 age groups
      const numAges = Math.floor(Math.random() * 2) + 1; // 1-2 age groups
      const ages = [];
      const shuffledAges = [...ageGroups].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numAges; i++) {
        ages.push(shuffledAges[i]);
      }
      
      // Random hourly rate between £30-80
      const hourlyRate = Math.floor(Math.random() * 50) + 30;
      
      const coachProfile = {
        age_groups: ages,
        credentials: [],
        hourly_rate: hourlyRate,
        availability: {},
        service_radius: 25,
        services_offered: services,
        rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        total_sessions: Math.floor(Math.random() * 50) + 5 // 5-54 sessions
      };
      
      await sql`
        UPDATE profiles 
        SET coach_profile = ${JSON.stringify(coachProfile)}
        WHERE id = ${coach.id}
      `;
      
      updated++;
      if (updated % 50 === 0) {
        console.log(`Updated ${updated}/${coaches.length} coaches...`);
      }
    }
    
    console.log(`✅ Successfully updated ${updated} coaches!`);
    
  } catch (error) {
    console.error('❌ Error updating coaches:', error);
    throw error;
  }
}

updateDummyCoaches();
