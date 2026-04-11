import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFactApiClient } from '@fact/api';
import { createAuthSession } from '@fact/auth';

const API_BASE = 'https://findacoachtoday.com/.netlify/functions';

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

export const mobileAuth = createAuthSession({
  userStorage: nativeStorage,
  tokenStorage: nativeStorage,
});

export const mobileApi = createFactApiClient({
  baseUrl: API_BASE,
  getAuthToken: () => mobileAuth.getStoredAuthToken(),
  onUnauthorized: async () => {
    await mobileAuth.setCurrentUser(null);
  },
});

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
