import { describe, expect, it } from 'vitest'
import {
  canAccessBookingConversation,
  canSendBookingMessage,
  canUpdateProfile,
} from '../netlify/functions/lib/permissions.js'

const booking = { client_id: 'client-a', coach_id: 'coach-a' }

describe('booking conversation permissions', () => {
  it('allows only participants or administrators to read a booking conversation', () => {
    expect(canAccessBookingConversation({ booking, userId: 'client-a' })).toBe(true)
    expect(canAccessBookingConversation({ booking, userId: 'coach-a' })).toBe(true)
    expect(canAccessBookingConversation({ booking, userId: 'outsider' })).toBe(false)
    expect(canAccessBookingConversation({ booking, userId: 'admin', isAdmin: true })).toBe(true)
  })

  it('prevents impersonation and outsider message injection', () => {
    expect(canSendBookingMessage({
      booking, userId: 'client-a', senderId: 'client-a', receiverId: 'coach-a',
    })).toBe(true)
    expect(canSendBookingMessage({
      booking, userId: 'outsider', senderId: 'outsider', receiverId: 'coach-a',
    })).toBe(false)
    expect(canSendBookingMessage({
      booking, userId: 'client-a', senderId: 'coach-a', receiverId: 'client-a',
    })).toBe(false)
  })
})

describe('profile update permissions', () => {
  it('allows self-service and administrators but rejects other users', () => {
    expect(canUpdateProfile({ targetUserId: 'client-a', userId: 'client-a' })).toBe(true)
    expect(canUpdateProfile({ targetUserId: 'coach-a', userId: 'client-a' })).toBe(false)
    expect(canUpdateProfile({ targetUserId: 'coach-a', userId: 'admin', isAdmin: true })).toBe(true)
  })
})
