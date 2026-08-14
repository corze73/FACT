export function calculateCancellationPolicy({ actor, hoursUntil, totalPence, servicePence }) {
  if (actor === 'coach' || actor === 'admin') {
    return {
      refundPence: totalPence,
      description: actor === 'coach'
        ? 'Full refund - coach cancellation'
        : 'Full refund - administrator cancellation'
    }
  }
  if (hoursUntil >= 48) {
    return {
      refundPence: servicePence,
      description: 'Service fee refund - client cancelled at least 48 hours before session'
    }
  }
  if (hoursUntil >= 24) {
    return {
      refundPence: Math.round(servicePence / 2),
      description: '50% service fee refund - client cancelled 24 to 48 hours before session'
    }
  }
  return {
    refundPence: 0,
    description: 'No refund - client cancelled within 24 hours of session'
  }
}
