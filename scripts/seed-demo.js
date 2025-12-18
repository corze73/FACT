#!/usr/bin/env node
// FACT Demo Coach Seeder
// Usage: node scripts/seed-demo.js
// Requires VITE_DATABASE_URL in .env (dev only)

import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const databaseUrl = process.env.VITE_DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ VITE_DATABASE_URL not set in environment');
  process.exit(1);
}
const sql = neon(databaseUrl);

// Helper: random element
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// UK cities (100+ coaches)
const ukCities = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield',
  'Edinburgh', 'Cardiff', 'Belfast', 'Nottingham', 'Leicester', 'Newcastle', 'Southampton',
  'Portsmouth', 'Brighton', 'Cambridge', 'Oxford', 'Aberdeen', 'Dundee', 'York', 'Bath', 'Exeter',
  'Reading', 'Milton Keynes', 'Coventry', 'Swansea', 'Plymouth', 'Derby', 'Stoke-on-Trent',
  'Wolverhampton', 'Norwich', 'Luton', 'Preston', 'Sunderland', 'Bradford', 'Kingston upon Hull',
  'Middlesbrough', 'Peterborough', 'Slough', 'Woking', 'Chelmsford', 'Gloucester', 'Blackpool',
  'Ipswich', 'Huddersfield', 'Warrington', 'Walsall', 'Bournemouth', 'Swindon', 'Oldham',
  'Bolton', 'Stockport', 'Rochdale', 'Solihull', 'Gateshead', 'Birkenhead', 'Basildon',
  'Eastbourne', 'Crawley', 'Grimsby', 'Hastings', 'Basingstoke', 'Maidstone', 'Harlow',
  'Colchester', 'Stevenage', 'Chatham', 'Hemel Hempstead', 'Bedford', 'Guildford', 'Aylesbury',
  'High Wycombe', 'Cheltenham', 'Lincoln', 'Shrewsbury', 'Stafford', 'Telford', 'Worcester',
  'Hereford', 'Chester', 'Carlisle', 'Durham', 'Lancaster', 'Winchester', 'Salisbury', 'Ely',
  'St Albans', 'Truro', 'Wells', 'Ripon', 'Lichfield', 'Stirling', 'Inverness', 'Perth', 'Dumfries'
];

// Global cities
const worldCities = [
  'New York', 'Los Angeles', 'Toronto', 'Sydney', 'Melbourne', 'Auckland', 'Cape Town', 'Paris',
  'Berlin', 'Madrid', 'Rome', 'Dublin', 'Amsterdam', 'Brussels', 'Zurich', 'Vienna', 'Prague',
  'Warsaw', 'Budapest', 'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Lisbon', 'Barcelona',
  'Milan', 'Munich', 'Frankfurt', 'Hamburg', 'Geneva', 'Lyon', 'Marseille', 'Nice', 'Athens',
  'Istanbul', 'Moscow', 'St Petersburg', 'Dubai', 'Abu Dhabi', 'Doha', 'Singapore', 'Hong Kong',
  'Tokyo', 'Osaka', 'Seoul', 'Beijing', 'Shanghai', 'Bangkok', 'Kuala Lumpur', 'Jakarta',
  'Manila', 'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Karachi', 'Lagos', 'Nairobi', 'Cairo',
  'Johannesburg', 'Mexico City', 'Sao Paulo', 'Buenos Aires', 'Lima', 'Bogota', 'Santiago',
  'Rio de Janeiro', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Halifax',
  'Quebec City', 'Winnipeg', 'Victoria', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast',
  'Canberra', 'Hobart', 'Darwin', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin',
  'Rotorua', 'Queenstown', 'Suva', 'Port Moresby', 'Apia', 'Nukuʻalofa', 'Pago Pago'
];

const sports = ['Football', 'Tennis', 'Basketball', 'Rugby', 'Cricket', 'Golf', 'Swimming', 'Cycling', 'Boxing', 'Martial Arts', 'Yoga', 'Pilates', 'Running', 'Triathlon', 'Rowing', 'Hockey', 'Netball', 'Badminton', 'Table Tennis', 'Squash'];
const bios = [
  'Passionate about helping athletes reach their potential.',
  '10+ years of coaching experience.',
  'Specialist in youth development.',
  'Former professional athlete.',
  'Focus on holistic training and mindset.',
  'Certified coach with international experience.',
  'Known for innovative training methods.',
  'Results-driven and client-focused.',
  'Expert in injury prevention and recovery.',
  'Motivational and supportive approach.'
];
const avatars = [
  'https://randomuser.me/api/portraits/men/1.jpg',
  'https://randomuser.me/api/portraits/women/2.jpg',
  'https://randomuser.me/api/portraits/men/3.jpg',
  'https://randomuser.me/api/portraits/women/4.jpg',
  'https://randomuser.me/api/portraits/men/5.jpg',
  'https://randomuser.me/api/portraits/women/6.jpg',
  'https://randomuser.me/api/portraits/men/7.jpg',
  'https://randomuser.me/api/portraits/women/8.jpg',
  'https://randomuser.me/api/portraits/men/9.jpg',
  'https://randomuser.me/api/portraits/women/10.jpg'
];

const firstNames = ['Alex', 'Jamie', 'Taylor', 'Jordan', 'Morgan', 'Casey', 'Riley', 'Drew', 'Avery', 'Skyler', 'Sam', 'Chris', 'Pat', 'Lee', 'Robin', 'Cameron', 'Dana', 'Jesse', 'Kerry', 'Shawn'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

function randomPrice() {
  // £15-£100, global currency GBP
  return Math.floor(Math.random() * 86) + 15;
}

function randomEmail(name, i) {
  return `${name.toLowerCase().replace(/ /g, '.')}.${i}@demo.fact.com`;
}

async function main() {
  // Set RLS context to admin (assume first admin in DB)
  const admins = await sql`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`;
  const adminId = admins[0]?.id;
  if (!adminId) {
    console.error('❌ No admin user found. Please create an admin first.');
    process.exit(1);
  }
  await sql`SELECT set_config('app.current_user_id', $1, true)`([adminId]);

  // Prepare 500+ coaches
  const total = 500;
  const ukCount = 100;
  const coaches = [];

  // UK coaches
  for (let i = 0; i < ukCount; i++) {
    const city = pick(ukCities);
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    coaches.push({
      id: randomUUID(),
      email: randomEmail(name, i),
      full_name: name,
      user_type: 'coach',
      role: 'coach',
      avatar_url: pick(avatars),
      bio: pick(bios),
      location: city + ', UK',
      sport: pick(sports),
      price: randomPrice(),
      is_active: true
    });
  }
  // Global coaches
  for (let i = ukCount; i < total; i++) {
    const city = pick(worldCities);
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    coaches.push({
      id: randomUUID(),
      email: randomEmail(name, i),
      full_name: name,
      user_type: 'coach',
      role: 'coach',
      avatar_url: pick(avatars),
      bio: pick(bios),
      location: city,
      sport: pick(sports),
      price: randomPrice(),
      is_active: true
    });
  }

  // Insert coaches
  let inserted = 0;
  for (const coach of coaches) {
    try {
      await sql`
        INSERT INTO profiles (id, email, full_name, user_type, role, avatar_url, bio, location, sport, price, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (email) DO NOTHING
      `([
        coach.id, coach.email, coach.full_name, coach.user_type, coach.role, coach.avatar_url,
        coach.bio, coach.location, coach.sport, coach.price, coach.is_active
      ]);
      inserted++;
      if (inserted % 50 === 0) console.log(`Inserted ${inserted} coaches...`);
    } catch (e) {
      console.error('Insert error:', e.message);
    }
  }
  console.log(`✅ Done! Inserted ${inserted} coaches.`);
}

main().catch(e => { console.error(e); process.exit(1); });
