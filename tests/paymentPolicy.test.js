import { describe, expect, it } from 'vitest'
import { calculateCancellationPolicy } from '../netlify/functions/lib/paymentPolicy.js'

const price = { totalPence: 5300, servicePence: 5000 }

describe('cancellation payment policy', () => {
  it('fully refunds a coach cancellation', () => {
    expect(calculateCancellationPolicy({ actor: 'coach', hoursUntil: 1, ...price }).refundPence).toBe(5300)
  })

  it('retains the booking fee when a client gives 48 hours notice', () => {
    expect(calculateCancellationPolicy({ actor: 'client', hoursUntil: 48, ...price }).refundPence).toBe(5000)
  })

  it('refunds half the coaching fee between 24 and 48 hours', () => {
    expect(calculateCancellationPolicy({ actor: 'client', hoursUntil: 30, ...price }).refundPence).toBe(2500)
  })

  it('does not refund a client cancellation within 24 hours', () => {
    expect(calculateCancellationPolicy({ actor: 'client', hoursUntil: 2, ...price }).refundPence).toBe(0)
  })
})
