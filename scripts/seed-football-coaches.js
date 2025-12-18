#!/usr/bin/env node
// FACT Football Coach Seeder (profiles-only)
// Usage: node scripts/seed-football-coaches.js
// Requires VITE_DATABASE_URL in environment (.env dev only)

import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const databaseUrl = process.env.VITE_DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ VITE_DATABASE_URL not set in environment');
  process.exit(1);
}
const sql = neon(databaseUrl);

const pick =(arr)=> arr[Math.floor(Math.random()*arr.length)];

const ukCities =[
  'London','Manchester','Birmingham','Leeds','Glasgow','Liverpool','Bristol','Sheffield',
  'Edinburgh','Cardiff','Belfast','Nottingham','Leicester','Newcastle','Southampton',
  'Portsmouth','Brighton','Cambridge','Oxford','Aberdeen','York','Bath','Exeter',
  'Reading','Milton Keynes','Coventry','Swansea','Plymouth','Derby','Norwich'
];

const worldCities =[
  'Lisbon','Porto','Madrid','Barcelona','Paris','Berlin','Rome','Milan','Amsterdam','Dublin',
  'New York','Los Angeles','Toronto','Sydney','Melbourne','Cape Town','Dubai','Singapore',
  'Tokyo','Seoul','Bangkok','Buenos Aires','Sao Paulo','Mexico City','Nairobi'
];

const bios =[
  'UEFA-inspired sessions focused on real match actions.',
  'High intensity, high detail—ball mastery and decision making.',
  'Player-first coaching with measurable progress each session.',
  'Technical coach focused on first touch, scanning, and execution.',
  'Supportive, structured sessions with clear weekly goals.'
];

const avatars =[
  'https://randomuser.me/api/portraits/men/11.jpg',
  'https://randomuser.me/api/portraits/women/12.jpg',
  'https://randomuser.me/api/portraits/men/13.jpg',
  'https://randomuser.me/api/portraits/women/14.jpg',
  'https://randomuser.me/api/portraits/men/15.jpg',
  'https://randomuser.me/api/portraits/women/16.jpg'
];

const firstNames =['Alex','Jamie','Taylor','Jordan','Morgan','Casey','Riley','Avery','Sam','Chris','Cameron','Jesse'];
const lastNames =['Smith','Johnson','Williams','Brown','Jones','Miller','Davis','Wilson','Anderson','Taylor'];

const randomPrice =()=> Math.floor(Math.random()*86)+15; // £15–£100
const slugify =(s)=> s.toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'');
const demoEmail =(name,i)=> `${slugify(name)}.${i}@demo.fact.com`;

async function main() {
  // Find admin for RLS context (if your RLS uses app.current_user_id)
  const admins = await sql`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`;
  const adminId = admins?.[0]?.id;

  if (!adminId) {
    console.error("❌ No admin profile found (profiles.role='admin'). Create an admin profile first.");
    process.exit(1);
  }

  await sql`SELECT set_config('app.current_user_id', ${adminId}, true)`;

  const total = 500;
  const ukCount = 100;

  let inserted = 0;

  for (let i = 0; i < total; i++) {
    const isUk = i < ukCount;
    const city = isUk ? pick(ukCities) : pick(worldCities);
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    const email = demoEmail(name, i);

    const res = await sql`
      INSERT INTO profiles (
        id, email, full_name, user_type, role,
        avatar_url, bio, location, sport, price, is_active,
        created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${email}, ${name}, 'coach', 'coach',
        ${pick(avatars)}, ${pick(bios)},
        ${isUk ? `${city}, UK` : city},
        'Football',
        ${randomPrice()},
        true,
        NOW(), NOW()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;

    if (res.length > 0) inserted++;

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${(i + 1)}/${total} processed, ${inserted} inserted`);
    }
  }

  console.log(`✅ Done! Inserted ${inserted} new football demo coaches into profiles.`);
}

main().catch((e) => {
  console.error('Seeder failed:', e);
  process.exit(1);
});