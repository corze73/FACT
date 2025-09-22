# Google OAuth Setup Instructions

## 1. Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API (if not already enabled)
4. Go to "Credentials" in the sidebar
5. Click "Create Credentials" → "OAuth 2.0 Client IDs"
6. Choose "Web application"
7. Add these authorized origins:
   - `http://localhost:5173` (for development)
   - `https://findacoachtoday.com` (your production domain)
   - `https://your-netlify-app.netlify.app` (your Netlify URL)

## 2. Configure Environment Variables

Create a `.env` file in your project root with:

```bash
# Copy from .env.example and add your actual values
VITE_DATABASE_URL=your-neon-database-url
VITE_GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com
```

## 3. OAuth Flow

When users click "Continue with Google":
1. Google OAuth popup will appear
2. User signs in with their Google account
3. If user exists in your database → logs them in
4. If new user → creates account and logs them in
5. Redirects to appropriate dashboard based on user role

## 4. Security Notes

- The Google Client ID is safe to expose in frontend code
- OAuth tokens are handled securely by Google
- User data is stored in your Neon database with RLS protection