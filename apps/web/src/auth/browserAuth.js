import apiClient from '@/api/apiClient.js';
import { auth } from '@/api/databaseClient.js';

export const signInWithGoogle = async () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.');
  }

  if (!window.google) {
    throw new Error('Google Identity Services not loaded. Please refresh the page.');
  }

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'email profile openid',
      callback: async (tokenResponse) => {
        try {
          if (tokenResponse.error) {
            throw new Error(tokenResponse.error);
          }

          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          });

          if (!userInfoResponse.ok) {
            throw new Error('Failed to get user info from Google');
          }

          const googleUser = await userInfoResponse.json();
          const profile = await apiClient.createUser({
            auth_mode: 'oauth',
            oauth_provider: 'google',
            oauth_access_token: tokenResponse.access_token,
            email: googleUser.email,
            full_name: googleUser.name || '',
            avatar_url: googleUser.picture || null
          });

          if (!profile || !profile.id) {
            throw new Error(profile?.error || 'Profile creation/login did not return a user id');
          }

          await auth.setCurrentUser({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
            user_type: profile.user_type,
            token: profile.token
          });

          resolve({ user: auth.currentUser });
        } catch (error) {
          reject(error);
        }
      }
    });

    client.requestAccessToken();
  });
};

export const storeAuthRedirect = (redirectUrl) => {
  if (!redirectUrl) return;

  try {
    sessionStorage.setItem('authRedirect', redirectUrl);
  } catch {
    // Ignore sessionStorage failures.
  }
};

export const consumeAuthRedirect = () => {
  try {
    const target = sessionStorage.getItem('authRedirect');
    if (target) {
      sessionStorage.removeItem('authRedirect');
    }
    return target;
  } catch {
    return null;
  }
};
