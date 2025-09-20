import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

// Neon database connection
const client = new Client({
  connectionString: 'REDACTED_NEON_URL'
});

const importData = async () => {
  try {
    await client.connect();
    console.log('Connected to Neon database');

    // Read the exported JSON data
    const exportFile = fs.readdirSync('.').find(file => file.startsWith('supabase-export-') && file.endsWith('.json'));
    if (!exportFile) {
      throw new Error('No export file found');
    }

    console.log(`Reading data from ${exportFile}...`);
    const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

    // Import profiles
    if (exportData.tables.profiles && exportData.tables.profiles.data.length > 0) {
      console.log('Importing profiles...');
      for (const profile of exportData.tables.profiles.data) {
        const query = `
          INSERT INTO profiles (
            id, email, full_name, user_type, location, skills, bio, avatar_url, 
            is_active, created_at, updated_at, phone, role, preferred_coaching_types, 
            preferred_session_times, coach_profile
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            user_type = EXCLUDED.user_type,
            location = EXCLUDED.location,
            skills = EXCLUDED.skills,
            bio = EXCLUDED.bio,
            avatar_url = EXCLUDED.avatar_url,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at,
            phone = EXCLUDED.phone,
            role = EXCLUDED.role,
            preferred_coaching_types = EXCLUDED.preferred_coaching_types,
            preferred_session_times = EXCLUDED.preferred_session_times,
            coach_profile = EXCLUDED.coach_profile
        `;
        
        await client.query(query, [
          profile.id,
          profile.email,
          profile.full_name,
          profile.user_type,
          profile.location,
          profile.skills,
          profile.bio,
          profile.avatar_url,
          profile.is_active,
          profile.created_at,
          profile.updated_at,
          profile.phone,
          profile.role,
          profile.preferred_coaching_types,
          profile.preferred_session_times,
          profile.coach_profile ? JSON.stringify(profile.coach_profile) : null
        ]);
      }
      console.log(`✓ Imported ${exportData.tables.profiles.data.length} profiles`);
    }

    // Import bookings (if any)
    if (exportData.tables.bookings && exportData.tables.bookings.data.length > 0) {
      console.log('Importing bookings...');
      for (const booking of exportData.tables.bookings.data) {
        const query = `
          INSERT INTO bookings (
            id, user_id, client_id, coach_id, status, booking_date, duration, 
            location, notes, price, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          ) ON CONFLICT (id) DO NOTHING
        `;
        
        await client.query(query, [
          booking.id,
          booking.user_id,
          booking.client_id,
          booking.coach_id,
          booking.status,
          booking.booking_date,
          booking.duration,
          booking.location,
          booking.notes,
          booking.price,
          booking.created_at,
          booking.updated_at
        ]);
      }
      console.log(`✓ Imported ${exportData.tables.bookings.data.length} bookings`);
    }

    // Import messages (if any)
    if (exportData.tables.messages && exportData.tables.messages.data.length > 0) {
      console.log('Importing messages...');
      for (const message of exportData.tables.messages.data) {
        const query = `
          INSERT INTO messages (
            id, sender_id, receiver_id, content, created_date, updated_at, is_read
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          ) ON CONFLICT (id) DO NOTHING
        `;
        
        await client.query(query, [
          message.id,
          message.sender_id,
          message.receiver_id,
          message.content,
          message.created_date || message.created_at,
          message.updated_at,
          message.is_read
        ]);
      }
      console.log(`✓ Imported ${exportData.tables.messages.data.length} messages`);
    }

    // Import reviews (if any)
    if (exportData.tables.reviews && exportData.tables.reviews.data.length > 0) {
      console.log('Importing reviews...');
      for (const review of exportData.tables.reviews.data) {
        const query = `
          INSERT INTO reviews (
            id, booking_id, reviewer_id, reviewee_id, rating, comment, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          ) ON CONFLICT (id) DO NOTHING
        `;
        
        await client.query(query, [
          review.id,
          review.booking_id,
          review.reviewer_id,
          review.reviewee_id,
          review.rating,
          review.comment,
          review.created_at,
          review.updated_at
        ]);
      }
      console.log(`✓ Imported ${exportData.tables.reviews.data.length} reviews`);
    }

    console.log('\n✓ Data import completed successfully!');

  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await client.end();
  }
};

importData();