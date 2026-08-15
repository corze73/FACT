import 'dotenv/config';
import nodemailer from 'nodemailer';

const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing email configuration: ${missing.join(', ')}`);

const port = Number(process.env.SMTP_PORT || 587);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT is invalid');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000
});

await transporter.verify();
console.log(JSON.stringify({
  passed: true,
  checks: ['SMTP settings present', 'SMTP authentication accepted'],
  host: 'configured',
  port,
  sender: process.env.SMTP_USER
}, null, 2));
transporter.close();
