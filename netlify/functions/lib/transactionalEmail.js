/* eslint-env node */
import nodemailer from 'nodemailer'
import { executeQuery, executeQueryOne } from './db.js'

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://findacoachtoday.com'

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export const formatMoney = (value) => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP'
}).format(Number(value || 0))

export const formatSessionDate = (value) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Europe/London'
}).format(new Date(value))

const emailShell = ({ heading, intro, details, actionLabel = 'View booking', actionPath = '/mybookings' }) => {
  const detailRows = details.map(([label, value]) => `
    <tr><td style="padding:6px 12px 6px 0;color:#52627a">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-weight:600">${escapeHtml(value)}</td></tr>`).join('')
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#101828;background:#f4f7fb;padding:24px">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:28px">
      <h1 style="font-size:24px;margin-top:0">${escapeHtml(heading)}</h1>
      <p style="line-height:1.6">${escapeHtml(intro)}</p>
      <table style="border-collapse:collapse;margin:20px 0">${detailRows}</table>
      <a href="${APP_BASE_URL}${actionPath}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">${escapeHtml(actionLabel)}</a>
      <p style="margin-top:28px;color:#667085;font-size:13px">FACT — Find a Coach Today</p>
    </div></body></html>`
}

const commonDetails = (booking) => [
  ['Session', booking.service_type || 'Football coaching session'],
  ['Date and time', formatSessionDate(booking.booking_date)],
  ['Duration', `${booking.duration} minutes`],
  ['Booking reference', booking.booking_reference || booking.id]
]

export const buildBookingEmails = (eventName, booking, eventDetails = {}) => {
  const clientName = booking.client_name || 'there'
  const coachName = booking.coach_name || 'your coach'
  const base = commonDetails(booking)

  if (eventName === 'booking_requested') {
    return [
      {
        recipient: 'coach',
        to: booking.coach_email,
        subject: `New FACT booking request from ${clientName}`,
        text: `Hi ${coachName}, you have a new booking request from ${clientName} for ${formatSessionDate(booking.booking_date)}.`,
        html: emailShell({ heading: 'New booking request', intro: `Hi ${coachName}, ${clientName} has requested a coaching session with you.`, details: base, actionPath: '/coachdashboard' })
      },
      {
        recipient: 'client',
        to: booking.client_email,
        subject: 'We received your FACT booking request',
        text: `Hi ${clientName}, your booking request with ${coachName} has been sent.`,
        html: emailShell({ heading: 'Booking request sent', intro: `Hi ${clientName}, your request has been sent to ${coachName}. We will let you know when it is confirmed.`, details: base })
      }
    ]
  }

  if (eventName === 'payment_confirmed') {
    const details = [...base, ['Amount paid', formatMoney(booking.total_price)]]
    return [
      {
        recipient: 'client',
        to: booking.client_email,
        subject: 'FACT payment received — booking confirmed',
        text: `Hi ${clientName}, we received ${formatMoney(booking.total_price)} and your session with ${coachName} is confirmed.`,
        html: emailShell({ heading: 'Payment received', intro: `Hi ${clientName}, your payment was successful and your session with ${coachName} is confirmed.`, details })
      },
      {
        recipient: 'coach',
        to: booking.coach_email,
        subject: 'FACT session confirmed',
        text: `Hi ${coachName}, your session with ${clientName} is confirmed.`,
        html: emailShell({ heading: 'Session confirmed', intro: `Hi ${coachName}, payment has been received and your session with ${clientName} is confirmed.`, details: base, actionPath: '/coachdashboard' })
      }
    ]
  }

  if (eventName === 'booking_cancelled') {
    const refundAmount = Number(eventDetails.refundAmount || 0)
    const details = [
      ...base,
      ['Cancelled by', eventDetails.cancelledBy || 'FACT'],
      ['Refund', refundAmount > 0 ? formatMoney(refundAmount) : 'No refund due'],
      ['Refund policy', eventDetails.refundPolicy || 'Cancellation policy applied']
    ]
    return [
      {
        recipient: 'client',
        to: booking.client_email,
        subject: 'FACT booking cancelled',
        text: `Hi ${clientName}, your session with ${coachName} has been cancelled. Refund: ${refundAmount > 0 ? formatMoney(refundAmount) : 'none due'}.`,
        html: emailShell({ heading: 'Booking cancelled', intro: `Hi ${clientName}, your session with ${coachName} has been cancelled.`, details })
      },
      {
        recipient: 'coach',
        to: booking.coach_email,
        subject: 'FACT booking cancelled',
        text: `Hi ${coachName}, your session with ${clientName} has been cancelled.`,
        html: emailShell({ heading: 'Booking cancelled', intro: `Hi ${coachName}, your session with ${clientName} has been cancelled.`, details, actionPath: '/coachdashboard' })
      }
    ]
  }

  return []
}

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

const getTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
})

export async function sendBookingEventEmails(bookingId, eventName, eventDetails = {}) {
  if (!smtpConfigured()) {
    console.warn(`[Transactional email] SMTP not configured; skipped ${eventName} for booking ${bookingId}`)
    return { sent: 0, skipped: true }
  }

  const booking = await executeQueryOne(
    `SELECT b.*, c.email AS coach_email, c.full_name AS coach_name,
            cl.email AS client_email, cl.full_name AS client_name
     FROM bookings b
     JOIN profiles c ON c.id = b.coach_id
     JOIN profiles cl ON cl.id = b.client_id
     WHERE b.id = $1`,
    [bookingId]
  )
  if (!booking) return { sent: 0, skipped: true }

  const messages = buildBookingEmails(eventName, booking, eventDetails).filter((message) => message.to)
  const transporter = getTransporter()
  let sent = 0

  for (const message of messages) {
    const eventKey = `booking:${bookingId}:${eventName}:${message.recipient}`
    const log = await executeQueryOne(
      `INSERT INTO email_logs (to_email, subject, html_content, text_content, status, event_key)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [message.to, message.subject, message.html, message.text, eventKey]
    )
    if (!log) continue

    try {
      const result = await transporter.sendMail({
        from: `FACT Support <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html
      })
      await executeQuery(
        `UPDATE email_logs SET status = 'sent', sent_at = NOW(), message_id = $2, updated_at = NOW() WHERE id = $1`,
        [log.id, result.messageId || null]
      )
      sent += 1
    } catch (error) {
      await executeQuery(
        `UPDATE email_logs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
        [log.id, String(error.message || error).slice(0, 2000)]
      )
      console.error(`[Transactional email] Failed ${eventKey}:`, error.message)
    }
  }
  return { sent, skipped: false }
}

export async function notifyBookingEvent(bookingId, eventName, eventDetails = {}) {
  try {
    return await sendBookingEventEmails(bookingId, eventName, eventDetails)
  } catch (error) {
    // A notification failure must never reverse a successful booking/payment change.
    console.error(`[Transactional email] ${eventName} dispatch failed for booking ${bookingId}:`, error.message)
    return { sent: 0, failed: true }
  }
}
