import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createFactApiClient } from '@fact/api';
import { createAuthSession } from '@fact/auth';

// EXPO_PUBLIC_API_BASE is baked into the bundle at EAS build time via eas.json env blocks.
// Falls back to production so local runs without a .env file work correctly.
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  'https://findacoachtoday.com/.netlify/functions';

const nativeStorage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Ignore storage write failures.
    }
  },
  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore storage delete failures.
    }
  },
};

const secureTokenStorage = {
  async getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key) {
    await SecureStore.deleteItemAsync(key);
  },
};

export const mobileAuth = createAuthSession({
  userStorage: nativeStorage,
  tokenStorage: secureTokenStorage,
});

export const mobileApi = createFactApiClient({
  baseUrl: API_BASE,
  getAuthToken: () => mobileAuth.getStoredAuthToken(),
  onUnauthorized: async () => {
    await mobileAuth.setCurrentUser(null);
  },
});

// iOS OAuth 2.0 client ID (from Google Cloud Console → Credentials → iOS client)
const GOOGLE_CLIENT_ID = '187916773186-pjp0ov3plq51qj38hm50ekk75hgvhv9c.apps.googleusercontent.com';

// Android OAuth 2.0 client ID (from Google Cloud Console → Credentials → Android client)
// Create this credential at https://console.cloud.google.com/ for package com.findacoachtoday.mobile
// then replace the placeholder below before building for Android.
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || null;

export async function signInWithGoogle(accessToken) {
  const signedInUser = await mobileApi.createUser({
    auth_mode: 'oauth',
    oauth_provider: 'google',
    oauth_access_token: accessToken,
  });

  if (!signedInUser?.id) {
    throw new Error(signedInUser?.error || 'Google sign-in failed. Please try again.');
  }

  await mobileAuth.setCurrentUser({
    id: signedInUser.id,
    email: signedInUser.email,
    full_name: signedInUser.full_name,
    user_type: signedInUser.user_type,
    role: signedInUser.role,
    token: signedInUser.token,
  });

  return signedInUser;
}

export { GOOGLE_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID };

export async function signInWithEmail(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }

  const signedInUser = await mobileApi.createUser({
    auth_mode: 'signin',
    email: normalizedEmail,
    password,
  });

  await mobileAuth.setCurrentUser({
    id: signedInUser.id,
    email: signedInUser.email,
    full_name: signedInUser.full_name,
    user_type: signedInUser.user_type,
    role: signedInUser.role,
    token: signedInUser.token,
  });

  return signedInUser;
}

export async function signOut() {
  await mobileAuth.signOut();
}

export async function getCurrentProfile() {
  const { data: { user } } = await mobileAuth.getUser();
  if (!user?.id) {
    return null;
  }

  return mobileApi.getUser(user.id);
}

const inferMimeType = (fileName = '') => {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/pdf';
};

export async function uploadComplianceAsset(asset, documentType = 'qualification') {
  const uri = asset?.uri;
  if (!uri) {
    throw new Error('No file selected.');
  }

  const name = asset?.name || `${documentType}-${Date.now()}.pdf`;
  const type = asset?.mimeType || inferMimeType(name);
  const token = await mobileAuth.getStoredAuthToken();

  const formData = new FormData();
  formData.append('file', {
    uri,
    name,
    type,
  });
  formData.append('document_type', documentType);

  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Upload failed');
  }

  const uploadedUrl = data?.data?.url;
  if (!uploadedUrl) {
    throw new Error('Upload did not return a file URL.');
  }

  return uploadedUrl;
}
