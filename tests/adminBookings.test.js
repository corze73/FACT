import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const bookingsFunction = readFileSync(
  resolve(process.cwd(), 'netlify/functions/bookings.js'),
  'utf8',
)

describe('admin booking list', () => {
  it('returns the fields required to control payout release', () => {
    const selectStart = bookingsFunction.indexOf('const baseSelect = isAdminListView')
    const selectEnd = bookingsFunction.indexOf("let query = `SELECT", selectStart)
    const adminListSelect = bookingsFunction.slice(selectStart, selectEnd)

    expect(selectStart).toBeGreaterThan(-1)
    expect(selectEnd).toBeGreaterThan(selectStart)
    expect(adminListSelect).toContain('b.payment_status')
    expect(adminListSelect).toContain('b.payout_eligible_at')
    expect(adminListSelect).toContain('b.dispute_status')
  })
})
