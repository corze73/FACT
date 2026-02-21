/**
 * Frontend API Client for Netlify Functions
 * Frontend talks only to Netlify Functions (no direct DB or Supabase access)
 */

import { captureFrontendError } from '@/lib/monitoring.js';

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:8888/.netlify/functions'  // Local dev with Netlify CLI
  : '/.netlify/functions';                       // Production

class APIClient {
  getAuthToken() {
    try {
      return localStorage.getItem('authToken');
    } catch (error) {
      console.error('Error reading auth token:', error);
      return null;
    }
  }

  /**
   * Make an API request to Netlify function
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return null;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        // Non-JSON response
        data = { error: `API error: ${response.status}` };
      }

      if (!response.ok) {
        // Propagate underlying error details when available for easier debugging
        const message = data.message || data.error || `API error: ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.details = data;

        if (response.status === 401) {
          try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            if (typeof window !== 'undefined' && window.location.pathname !== '/') {
              window.location.href = '/';
            }
          } catch {
            // Ignore localStorage/window access failures
          }
        }

        captureFrontendError(err, {
          source: 'apiClient.request',
          endpoint,
          status: response.status,
          method: options.method || 'GET'
        });
        throw err;
      }

      return data;
    } catch (error) {
      captureFrontendError(error, {
        source: 'apiClient.request.catch',
        endpoint,
        method: options.method || 'GET'
      });
      console.error('API request failed:', error);
      throw error;
    }
  }

  // ========== USER OPERATIONS ==========

  /**
   * Get single user by ID
   */
  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  /**
   * Get all coaches (role='coach')
   */
  async getCoaches(filters = {}) {
    if (typeof filters === 'string') {
      const query = filters ? `?${filters}` : '?role=coach';
      return this.request(`/users${query}`);
    }
    const params = new URLSearchParams({ role: 'coach', ...filters });
    return this.request(`/users?${params}`);
  }

  /**
   * Get single coach by ID
   */
  async getCoachById(id) {
    return this.request(`/users/${id}`);
  }

  // ========== ACCOUNT DELETION REQUESTS ==========
  async createDeletionRequest(userId, reason) {
    return this.request('/account-deletion-requests', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, reason })
    });
  }

  async listDeletionRequests(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/account-deletion-requests?${params}`);
  }

  async decideDeletionRequest(id, decision, decision_reason, admin_id) {
    return this.request('/account-deletion-requests', {
      method: 'PUT',
      body: JSON.stringify({ id, decision, decision_reason, admin_id })
    });
  }

  /**
   * Get all users (with optional filters)
   */
  async getUsers(filters = {}) {
    if (typeof filters === 'string') {
      const query = filters ? `?${filters}` : '';
      return this.request(`/users${query}`);
    }
    const params = new URLSearchParams(filters);
    return this.request(`/users?${params}`);
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  /**
   * Update user
   */
  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  /**
   * Delete user
   */
  async deleteUser(id, options = {}) {
    const { reason, hard } = options;
    const req = { method: 'DELETE' };
    if (reason || hard) {
      req.body = JSON.stringify({ reason, hard });
    }
    return this.request(`/users/${id}`, req);
  }

  // ========== BOOKING OPERATIONS ==========

  /**
   * Get single booking by ID
   */
  async getBooking(id) {
    return this.request(`/bookings/${id}`);
  }

  /**
   * Alias for getBooking (for consistency with hooks)
   */
  async getBookingById(id) {
    return this.getBooking(id);
  }

  /**
   * Get all bookings (with optional filters)
   */
  async getBookings(filters = {}) {
    if (typeof filters === 'string') {
      const query = filters ? `?${filters}` : '';
      return this.request(`/bookings${query}`);
    }
    const params = new URLSearchParams(filters);
    return this.request(`/bookings?${params}`);
  }

  /**
   * Get booking statistics (admin dashboard)
   */
  async getBookingStats() {
    return this.request('/bookings?stats=1');
  }

  /**
   * Create new booking
   */
  async createBooking(bookingData) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  }

  /**
   * Update booking
   */
  async updateBooking(id, bookingData) {
    return this.request(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bookingData)
    });
  }

  /**
   * Delete booking
   */
  async deleteBooking(id) {
    return this.request(`/bookings/${id}`, {
      method: 'DELETE'
    });
  }

  // ========== MESSAGE OPERATIONS ==========

  /**
   * Get messages for a booking
   */
  async getMessages(bookingId) {
    return this.request(`/messages?booking_id=${bookingId}`);
  }

  /**
   * Get direct messages between the current user and another user (no booking)
   */
  async getDirectMessages(userId) {
    return this.request(`/messages?direct_user_id=${userId}`);
  }

  /**
   * Get list of direct-message threads (no booking) for current user
   */
  async getDirectThreads() {
    return this.request('/messages?direct_threads=1');
  }

  /**
   * Send a message
   */
  async sendMessage(messageData) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData)
    });
  }

  /**
   * Mark message as read
   */
  async markMessageRead(messageId) {
    return this.request(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_read: true })
    });
  }
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;
