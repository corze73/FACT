import { describe, expect, it } from 'vitest'
import { buildBookingEmails, formatMoney, formatSessionDate } from '../netlify/functions/lib/transactionalEmail.js'

const booking = {
  id: 'booking-123',
  booking_reference: 'FACT-TEST-123',
  coach_name: 'Test Coach',
  coach_email: 'coach@example.com',
  client_name: 'Test Client',
  client_email: 'client@example.com',
  service_type: 'Technical Skills',
  booking_date: '2026-08-20T17:00:00.000Z',
  duration: 60,
  total_price: 53
}

describe('transactional booking email templates', () => {
  it('formats UK money and session dates', () => {
    expect(formatMoney(53)).toBe('£53.00')
    expect(formatSessionDate(booking.booking_date)).toContain('20 August 2026')
  })

  it.each(['booking_requested', 'payment_confirmed', 'booking_cancelled'])(
    'creates client and coach messages for %s',
    (eventName) => {
      const messages = buildBookingEmails(eventName, booking, {
        cancelledBy: 'client',
        refundAmount: 53,
        refundPolicy: 'Full refund'
      })
      expect(messages).toHaveLength(2)
      expect(messages.map((message) => message.to)).toEqual(expect.arrayContaining([
        'client@example.com',
        'coach@example.com'
      ]))
      for (const message of messages) {
        expect(message.subject).toBeTruthy()
        expect(message.text).toContain('Test')
        expect(message.html).toContain('FACT')
      }
    }
  )

  it('escapes participant names in HTML messages', () => {
    const messages = buildBookingEmails('booking_requested', {
      ...booking,
      client_name: '<script>alert(1)</script>'
    })
    expect(messages[0].html).not.toContain('<script>')
    expect(messages[0].html).toContain('&lt;script&gt;')
  })
})
