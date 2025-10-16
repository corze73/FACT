#!/usr/bin/env node
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const databaseUrl = process.env.VITE_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing VITE_DATABASE_URL or DATABASE_URL. Please export it before running.');
  process.exit(1);
}

const sql = neon(databaseUrl);
const SEED_TAG = 'seed-demo';

async function upsertUser(email, full_name, user_type = 'user', role = 'user') {
  const rows = await sql`
    INSERT INTO profiles (id, email, full_name, user_type, role, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${email}, ${full_name}, ${user_type}, ${role}, true, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
      SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
          user_type = COALESCE(EXCLUDED.user_type, profiles.user_type),
          role = COALESCE(EXCLUDED.role, profiles.role),
          updated_at = NOW()
    RETURNING *
  `;
  return rows[0];
}

async function ensureBooking(coach_id, client_id, status, dateOffsetDays, service_type = 'personal_training') {
  const existing = await sql`
    SELECT id FROM bookings 
    WHERE coach_id = ${coach_id} AND client_id = ${client_id} AND status = ${status} AND notes = ${SEED_TAG}
    LIMIT 1
  `;
  if (existing.length) return existing[0];

  const sessionDate = new Date();
  sessionDate.setDate(sessionDate.getDate() + dateOffsetDays);
  const isoDate = sessionDate.toISOString().slice(0, 10);

  const rows = await sql`
    INSERT INTO bookings (
      coach_id, client_id, service_type, session_date, session_time,
      duration, location_type, total_price, status, notes
    ) VALUES (
      ${coach_id}, ${client_id}, ${service_type}, ${isoDate}, ${'15:00'},
      ${60}, ${'online'}, ${75.00}, ${status}, ${SEED_TAG}
    ) RETURNING *
  `;
  return rows[0];
}

async function seedMessages(booking, client_id, coach_id) {
  const existing = await sql`SELECT id FROM messages WHERE booking_id = ${booking.id} LIMIT 1`;
  if (existing.length) return;
  await sql`
    INSERT INTO messages (booking_id, sender_id, receiver_id, content)
    VALUES (${booking.id}, ${client_id}, ${coach_id}, ${'Hi coach! Looking forward to our session.'})
  `;
  await sql`
    INSERT INTO messages (booking_id, sender_id, receiver_id, content)
    VALUES (${booking.id}, ${coach_id}, ${client_id}, ${'Great! See you then.'})
  `;
}

async function create() {
  console.log('🌱 Seeding demo data...');
  const coach = await upsertUser('seed+coach@fact.test', 'Seed Coach', 'coach', 'user');
  const client = await upsertUser('seed+client@fact.test', 'Seed Client', 'user', 'user');
  const coach2 = await upsertUser('seed+coach2@fact.test', 'Seed Coach 2', 'coach', 'user');

  const b1 = await ensureBooking(coach.id, client.id, 'pending', 7);
  const b2 = await ensureBooking(coach.id, client.id, 'confirmed', 3);
  const b3 = await ensureBooking(coach2.id, client.id, 'completed', -10, 'nutrition_guidance');

  await seedMessages(b1, client.id, coach.id);
  await seedMessages(b2, client.id, coach.id);
  await seedMessages(b3, client.id, coach2.id);

  console.log('✅ Done');
  console.log({ users: [coach.id, client.id, coach2.id], bookings: [b1.id, b2.id, b3.id] });
}

async function clear() {
  console.log('🧹 Clearing demo data...');
  const users = await sql`SELECT id FROM profiles WHERE email IN (${ 'seed+coach@fact.test' }, ${ 'seed+client@fact.test' }, ${ 'seed+coach2@fact.test' })`;
  const userIds = users.map(u => u.id);

  if (userIds.length) {
    await sql`DELETE FROM messages WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = ANY(${userIds}) OR coach_id = ANY(${userIds}) OR notes = ${SEED_TAG})`;
    await sql`DELETE FROM bookings WHERE client_id = ANY(${userIds}) OR coach_id = ANY(${userIds}) OR notes = ${SEED_TAG}`;
    await sql`DELETE FROM profiles WHERE id = ANY(${userIds})`;
  } else {
    await sql`DELETE FROM messages WHERE booking_id IN (SELECT id FROM bookings WHERE notes = ${SEED_TAG})`;
    await sql`DELETE FROM bookings WHERE notes = ${SEED_TAG}`;
  }
  console.log('✅ Cleared');
}

(async () => {
  const action = process.argv[2] || 'create';
  try {
    if (action === 'clear') await clear();
    else await create();
  } catch (e) {
    console.error('❌ Seed error:', e.message);
    process.exit(1);
  }
})();
