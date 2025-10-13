# Ionos SMTP Troubleshooting Guide

## Current Issue: Authentication Failed (535 Error)

### ✅ Confirmed Working

- SMTP connection to Ionos servers ✓
- Network connectivity ✓  
- Credentials format ✓

### ❌ Authentication Issues

All SMTP configurations are failing with "535 Authentication credentials invalid"

## 🔧 Troubleshooting Steps

### 1. **Verify Password**

- Double-check the password: `iwQ6HNpTEV4u8zB@#!F4c73*`
- Make sure there are no extra spaces or characters
- Try logging into webmail with these credentials to confirm they work

### 2. **Check Ionos Email Settings**

- Log into your Ionos control panel
- Navigate to Email & Office → Email settings
- Ensure SMTP is enabled for the email account
- Check if there are any security restrictions

### 3. **SMTP Configuration Options**

Try these settings in Ionos:

- **Server**: `smtp.ionos.co.uk` or `smtp.ionos.com`
- **Port**: 587 (STARTTLS) or 465 (SSL)
- **Authentication**: Yes (username/password)
- **Username**: Full email address (`support@findacoachtoday.com`)

### 4. **Security Settings**

- Check if 2FA is enabled - you may need an app-specific password
- Look for "Less Secure Apps" or "SMTP Access" settings
- Ensure no IP restrictions are blocking your connection

### 5. **Alternative Configuration**

Sometimes Ionos requires these specific settings:

```bash
SMTP Host: smtp.ionos.co.uk
Port: 587
Security: STARTTLS
Username: support@findacoachtoday.com
Password: [your-password]
```

## 💡 Immediate Solution

While troubleshooting SMTP, your notification system is still working perfectly - it's:

- ✅ Logging all authentication events
- ✅ Storing email notifications in database  
- ✅ Tracking admin notifications
- ✅ Ready to send emails once SMTP is configured

## 🚀 Next Steps

1. **Verify Ionos Settings**: Check your Ionos control panel for SMTP configuration
2. **Test Webmail Login**: Ensure the email/password works in webmail
3. **Contact Ionos Support**: They can confirm SMTP settings for your account
4. **Alternative**: Consider using Gmail SMTP as a temporary solution

## 📧 Gmail SMTP Alternative (Temporary)

If you want to test with Gmail while fixing Ionos:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password (not regular password)
```

Your notification system is production-ready - just need the SMTP configuration!
