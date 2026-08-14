import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const usersFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/users.js'), 'utf8')
const bookingsFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/bookings.js'), 'utf8')
const adminFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/admin.js'), 'utf8')
const profileFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/profile.js'), 'utf8')

describe('coach safeguarding gates', () => {
  it('only exposes coaches whose qualification and current background check are verified', () => {
    expect(usersFunction).toContain("conditions.push(`qualification_status = 'verified'`)")
    expect(usersFunction).toContain("conditions.push(`has_background_check = true`)")
    expect(usersFunction).toContain("conditions.push(`background_check_status = 'verified'`)")
    expect(usersFunction).toContain('background_check_expires_at >= CURRENT_DATE')
  })

  it('blocks booking creation when the coach is not fully verified', () => {
    expect(bookingsFunction).toContain("coach.qualification_status !== 'verified'")
    expect(bookingsFunction).toContain("coach.background_check_status === 'verified'")
    expect(bookingsFunction).toContain('awaiting verification and cannot accept bookings')
  })

  it('requires supporting evidence before an administrator approves a coach', () => {
    expect(adminFunction).toContain('A qualification type and document are required before approval')
    expect(adminFunction).toContain('A background-check type and document are required before approval')
    expect(adminFunction).toContain('A current background-check expiry date is required before approval')
  })

  it('removes the verified marker whenever a coach changes compliance evidence', () => {
    expect(profileFunction).toContain("'{is_verified}', 'false'::jsonb")
  })
})
