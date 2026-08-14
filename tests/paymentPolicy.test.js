import { describe, expect, it } from 'vitest'
import { calculateCancellationPolicy } from '../netlify/functions/lib/paymentPolicy.js'
import { calculateDisputeResolution } from '../netlify/functions/lib/disputeResolution.js'

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

describe('administrator dispute resolution', () => {
  it('calculates full, partial, and no-refund decisions in pence', () => {
    expect(calculateDisputeResolution({ decision: 'refund_full', totalAmount: 53 }).refundPence).toBe(5300)
    expect(calculateDisputeResolution({ decision: 'refund_partial', refundAmount: 20, totalAmount: 53 }).refundPence).toBe(2000)
    expect(calculateDisputeResolution({ decision: 'no_refund', totalAmount: 53 }).refundPence).toBe(0)
  })

  it('rejects invalid partial refund amounts', () => {
    expect(() => calculateDisputeResolution({ decision: 'refund_partial', refundAmount: 53, totalAmount: 53 })).toThrow('less than')
    expect(() => calculateDisputeResolution({ decision: 'refund_partial', refundAmount: 0, totalAmount: 53 })).toThrow('greater than')
  })
})
