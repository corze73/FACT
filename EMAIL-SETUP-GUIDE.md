# Email Configuration Guide for FACT

## Current Email Setup

Your existing email addresses through Ionos:

- **Support Email**: `support@findacoachtoday.com`
- **Admin Email**: `admin@findacoachtoday.co.uk`

## Environment Variables

The following are already configured in your `.env` file:

```bash
VITE_ADMIN_EMAIL=admin@findacoachtoday.co.uk
VITE_SUPPORT_EMAIL=support@findacoachtoday.com
```

## Ionos SMTP Configuration

To enable actual email sending (not just logging), update the `sendEmail` function in `/src/api/emailService.js` with your Ionos SMTP settings:

### Ionos SMTP Settings

```javascript
// Add these to your .env file:
SMTP_HOST=smtp.ionos.co.uk  // or smtp.ionos.com depending on your region
SMTP_PORT=587  // or 465 for SSL
SMTP_SECURE=false  // true for 465, false for other ports
SMTP_USER=support@findacoachtoday.com
SMTP_PASS=your_email_password
```

### Implementation Example

Replace the TODO section in `emailService.js` with:

```javascript
// Using nodemailer with Ionos SMTP
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const info = await transporter.sendMail({
  from: `"FACT Support" <${process.env.VITE_SUPPORT_EMAIL}>`,
  to: to,
  subject: subject,
  html: htmlContent,
  text: textContent
});
```

## Email Flow Summary

1. **Admin Notifications**: All authentication events → `admin@findacoachtoday.co.uk`
2. **User Support**: Help requests and failure notifications → `support@findacoachtoday.com`
3. **Welcome Emails**: Sent from support email to maintain consistency
4. **Error Handling**: All failures are logged and admin is notified

## Next Steps

1. Install nodemailer: `npm install nodemailer`
2. Add SMTP credentials to `.env` file
3. Update the `sendEmail` function in `emailService.js`
4. Test with the existing notification system

## Security Notes

- Never commit SMTP passwords to version control
- Use environment variables for all sensitive configuration
- Consider using app-specific passwords if available through Ionos
- Monitor email delivery logs for any issues

The notification system is fully functional and will start sending real emails once SMTP is configured!
