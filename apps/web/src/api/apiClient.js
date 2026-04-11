/**
 * Frontend API Client for Netlify Functions
 * Frontend talks only to Netlify Functions (no direct DB or Supabase access)
 */

import { createFactApiClient } from '@fact/api';
import { auth, getStoredAuthToken } from './databaseClient.js';
import { captureFrontendError } from '@/lib/monitoring.js';

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:8888/.netlify/functions'  // Local dev with Netlify CLI
  : '/.netlify/functions';                       // Production

const getAuthToken = () => getStoredAuthToken();

const onUnauthorized = async () => {
  await auth.setCurrentUser(null);
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

const captureError = (error, context) => {
  captureFrontendError(error, context);
  console.error('API request failed:', error);
};

export const apiClient = createFactApiClient({
  baseUrl: API_BASE,
  getAuthToken,
  onUnauthorized,
  captureError,
});

export default apiClient;
