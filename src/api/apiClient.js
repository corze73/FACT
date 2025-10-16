/**
 * Frontend API Client for Netlify Functions
 * Frontend talks only to Netlify Functions (no direct DB or Supabase access)
 */

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:8888/.netlify/functions'  // Local dev with Netlify CLI
  : '/.netlify/functions';                       // Production

class APIClient {
  /**
   * Make an API request to Netlify function
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
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
   * Get all users (with optional filters)
   */
  async getUsers(filters = {}) {
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
  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE'
    });
  }

  // ========== BOOKING OPERATIONS ==========

  /**
   * Get single booking by ID
   */
  async getBooking(id) {
    return this.request(`/bookings/${id}`);
  }

  /**
   * Get all bookings (with optional filters)
   */
  async getBookings(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/bookings?${params}`);
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
