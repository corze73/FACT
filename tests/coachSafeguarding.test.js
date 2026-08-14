import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const usersFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/users.js'), 'utf8')
const bookingsFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/bookings.js'), 'utf8')
const adminFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/admin.js'), 'utf8')
const profileFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/profile.js'), 'utf8')
const safeguardingFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/safeguarding.js'), 'utf8')
const adminOpsFunction = readFileSync(resolve(process.cwd(), 'netlify/functions/admin-ops.js'), 'utf8')
const safeguardingPage = readFileSync(resolve(process.cwd(), 'apps/web/src/pages/SafeguardingReport.jsx'), 'utf8')

describe('coach safeguarding gates', () => {
  it('only exposes coaches whose qualification and current background check are verified', () => {
    expect(usersFunction).toContain("conditions.push(`qualification_status = 'verified'`)")
    expect(usersFunction).toContain("conditions.push(`has_background_check = true`)")
    expect(usersFunction).toContain("conditions.push(`background_check_status = 'verified'`)")
    expect(usersFunction).toContain('background_check_expires_at >= CURRENT_DATE')
    expect(usersFunction).toContain('AND COALESCE(is_active, true) = true')
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

  it('creates high-priority cases and escalates immediate danger reports to critical', () => {
    expect(safeguardingFunction).toContain("const priority = immediateDanger ? 'critical' : 'high'")
    expect(safeguardingFunction).toContain("'Safeguarding concern'")
    expect(safeguardingFunction).toContain("'safeguarding'")
  })

  it('does not expose booking reports to people outside the booking', () => {
    expect(safeguardingFunction).toContain('(client_id = $2 OR coach_id = $2)')
    expect(safeguardingFunction).toContain('You cannot report against this booking')
  })

  it('warns reporters to call emergency services where immediate danger exists', () => {
    expect(safeguardingPage).toContain('If anyone is in immediate danger, call 999 now.')
    expect(safeguardingPage).toContain('not monitored as an emergency service')
  })

  it('suspends a coach named in a safeguarding case and revokes active sessions', () => {
    expect(adminOpsFunction).toContain("existing.category !== 'safeguarding'")
    expect(adminOpsFunction).toContain('SET is_active = false')
    expect(adminOpsFunction).toContain('token_revoked_at = NOW()')
    expect(adminOpsFunction).toContain("'verification_status', 'suspended'")
  })
})
