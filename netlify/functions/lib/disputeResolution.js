export const calculateDisputeResolution = ({ decision, refundAmount, totalAmount }) => {
  const totalPence = Math.round(Number(totalAmount) * 100)
  if (!Number.isInteger(totalPence) || totalPence <= 0) throw new Error('Invalid booking total')

  if (decision === 'refund_full') return { refundPence: totalPence }
  if (decision === 'no_refund') return { refundPence: 0 }
  if (decision === 'refund_partial') {
    const refundPence = Math.round(Number(refundAmount) * 100)
    if (!Number.isInteger(refundPence) || refundPence <= 0 || refundPence >= totalPence) {
      throw new Error('Partial refund must be greater than zero and less than the total payment')
    }
    return { refundPence }
  }
  throw new Error('A valid refund decision is required')
}
