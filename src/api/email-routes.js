/* eslint-env node */
// Server-side email API routes
import express from 'express';
import nodemailer from 'nodemailer';
import { db } from './databaseClient.js';

const router = express.Router();

// Create SMTP transporter for Ionos (SERVER-SIDE ONLY)
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email endpoint (POST /api/email/send)
router.post('/send', async (req, res) => {
  try {
    const { to, subject, htmlContent, textContent = '', metadata } = req.body;
    
    if (!to || !subject || !htmlContent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      html: htmlContent,
      text: textContent
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    // Log email to database
    if (metadata) {
      await db.insert('email_logs', {
        to_email: to,
        subject,
        status: 'sent',
        message_id: info.messageId,
        metadata: JSON.stringify(metadata),
        sent_at: new Date().toISOString()
      });
    }
    
    res.json({ 
      success: true, 
      messageId: info.messageId,
      message: `Email sent successfully to ${to}`
    });
    
  } catch (error) {
    console.error('Email send error:', error);
    
    // Log failed email
    try {
      await db.insert('email_logs', {
        to_email: req.body.to,
        subject: req.body.subject,
        status: 'failed',
        error_message: error.message,
        sent_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }
    
    res.status(500).json({ 
      error: 'Failed to send email',
      message: error.message 
    });
  }
});

export default router;