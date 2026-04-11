/**
 * Frontend API Client for Netlify Functions
 * Frontend talks only to Netlify Functions (no direct DB or Supabase access)
 */

import { createFactApiClient } from '@fact/api';
import { captureFrontendError } from '@/lib/monitoring.js';

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:8888/.netlify/functions'  // Local dev with Netlify CLI
  : '/.netlify/functions';                       // Production

const getAuthToken = () => {
  try {
    return localStorage.getItem('authToken');
  } catch (error) {
    console.error('Error reading auth token:', error);
    return null;
  }
};

const onUnauthorized = async () => {
  try {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }
  } catch {
    // Ignore localStorage/window access failures
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
