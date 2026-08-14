export const isBookingParticipant = (booking, userId) => Boolean(
  booking && userId && (booking.client_id === userId || booking.coach_id === userId)
)

export const canAccessBookingConversation = ({ booking, userId, isAdmin = false }) => (
  Boolean(isAdmin) || isBookingParticipant(booking, userId)
)

export const canSendBookingMessage = ({ booking, userId, senderId, receiverId, isAdmin = false }) => {
  if (!booking || !userId || senderId !== userId) return false
  const receiverIsParticipant = receiverId === booking.client_id || receiverId === booking.coach_id
  if (!receiverIsParticipant) return false
  if (isAdmin) return true
  return isBookingParticipant(booking, userId) && receiverId !== userId
}

export const canUpdateProfile = ({ targetUserId, userId, isAdmin = false }) => (
  Boolean(isAdmin) || (Boolean(userId) && targetUserId === userId)
)
