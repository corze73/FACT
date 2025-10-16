import apiClient from './apiClient';
import { db, auth } from './databaseClient';

/**
 * MIGRATION WRAPPER
 * This file gradually migrates from direct database access to secure Netlify functions
 * 
 * Status:
 * ✅ User - Migrated to API (except auth functions)
 * ✅ Booking - Migrated to API
 * ✅ Message - Migrated to API
 * ⏳ Review - Still using direct DB (low priority)
 * ⏳ Payment - Still using direct DB (Stripe handles most)
 * ⏳ SessionDispute - Still using direct DB (rare usage)
 * ⏳ CoachAvailability - Still using direct DB (will migrate)
 * ⏳ CoachRecurringAvailability - Still using direct DB (will migrate)
 */

// ========== USER ENTITY (Migrated to API) ==========
export const User = {
  // Auth functions still use auth client (Google OAuth)
  async me() {
    const { data: { user }, error } = await auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Not authenticated');

    try {
      // Try to get user from API
      const profile = await apiClient.getUser(user.id);
      return {
        id: user.id,
        email: user.email,
        ...profile
      };
    } catch (apiError) {
      // Fallback: If API fails or user doesn't exist in DB yet
      console.warn('API fetch failed, creating profile:', apiError);
      
      // Get from database directly (fallback)
      const profiles = await db.select('profiles', { where: { id: user.id } });
      let profile = profiles[0];

      if (!profile) {
        // Create basic profile via API
        const newProfile = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
          role: 'user',
          user_type: 'user',
          is_active: true
        };

        try {
          profile = await apiClient.createUser(newProfile);
        } catch (createError) {
          console.error('Failed to create user via API:', createError);
          // Fallback to direct DB
          profile = await db.insert('profiles', newProfile);
        }
      }

      return {
        id: user.id,
        email: user.email,
        ...profile
      };
    }
  },

  async list() {
    try {
      return await apiClient.getUsers();
    } catch (error) {
      console.error('API list failed, using fallback:', error);
      // Fallback to direct DB
      const data = await db.select('profiles', {
        orderBy: { created_at: 'desc' },
        limit: 1000
      });
      return data || [];
    }
  },

  async get(id) {
    try {
      return await apiClient.getUser(id);
    } catch (error) {
      console.error('API get failed, using fallback:', error);
      // Fallback to direct DB
      const users = await db.select('profiles', { where: { id } });
      if (users.length === 0) {
        throw new Error('User not found');
      }
      return users[0];
    }
  },

  async filter(filters) {
    try {
      // Convert filters to query parameters
      const queryParams = {};
      if (filters.role) queryParams.role = filters.role;
      
      return await apiClient.getUsers(queryParams);
    } catch (error) {
      console.error('API filter failed, using fallback:', error);
      // Fallback to direct DB
      const options = { where: {} };
      
      if (filters.id?.in) {
        const placeholders = filters.id.in.map((_, i) => `$${i + 1}`).join(', ');
        const query = `SELECT * FROM profiles WHERE id IN (${placeholders})`;
        return await db.query(query, filters.id.in);
      }
      
      if (filters.role) {
        options.where.role = filters.role;
      }
      
      return await db.select('profiles', options);
    }
  },

  async update(id, userData) {
    try {
      return await apiClient.updateUser(id, userData);
    } catch (error) {
      console.error('API update failed, using fallback:', error);
      // Fallback to direct DB
      await db.update('profiles', { where: { id } }, userData);
      return await this.get(id);
    }
  },

  async updateMyUserData(userData) {
    const { data: { user }, error: authError } = await auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Not authenticated');

    // Prepare data for update
    const dataToUpdate = { ...userData };

    // If location is an object, extract the address string
    if (typeof dataToUpdate.location === 'object' && dataToUpdate.location !== null && 'address' in dataToUpdate.location) {
      dataToUpdate.location = dataToUpdate.location.address;
    }

    return await this.update(user.id, dataToUpdate);
  },

  // Auth functions use Google OAuth + custom auth object
  async login() {
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

            // Get user info from Google
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });

            if (!userInfoResponse.ok) {
              throw new Error('Failed to get user info from Google');
            }

            const googleUser = await userInfoResponse.json();

            // Call login API function to check if user exists and create if needed
            try {
              const loginResponse = await fetch('/.netlify/functions/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: googleUser.email,
                  full_name: googleUser.name || '',
                  avatar_url: googleUser.picture || null
                })
              });

              if (!loginResponse.ok) {
                throw new Error(`Login API failed: ${loginResponse.status}`);
              }

              const user = await loginResponse.json();

              // Set as current user with full profile data
              await auth.setCurrentUser({
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: user.role,
                user_type: user.user_type
              });
              resolve({ user: auth.currentUser });
            } catch (apiError) {
              console.error('Login API error:', apiError);
              throw apiError;
            }
          } catch (error) {
            reject(error);
          }
        }
      });
      
      client.requestAccessToken();
    });
  },

  async logout() {
    const { error } = await auth.signOut();
    if (error) throw error;
  },

  async loginWithRedirect(redirectUrl) {
    // Store redirect URL for after login
    if (redirectUrl) {
      sessionStorage.setItem('authRedirect', redirectUrl);
    }
    return await this.login();
  },

  async isAuthenticated() {
    try {
      const { data: { user }, error } = await auth.getUser();
      return !error && user !== null;
    } catch {
      return false;
    }
  },

  onAuthStateChange(callback) {
    return auth.onAuthStateChange(callback);
  }
};

// ========== BOOKING ENTITY (Migrated to API) ==========
export const Booking = {
  async list() {
    try {
      return await apiClient.getBookings();
    } catch (error) {
      console.error('API list failed, using fallback:', error);
      const data = await db.select('bookings', {
        orderBy: { created_date: 'desc' }
      });
      return data || [];
    }
  },

  async get(id) {
    try {
      return await apiClient.getBooking(id);
    } catch (error) {
      console.error('API get failed, using fallback:', error);
      const bookings = await db.select('bookings', { where: { id } });
      if (bookings.length === 0) {
        throw new Error('Booking not found');
      }
      return bookings[0];
    }
  },

  async filter(filters, orderBy = 'created_date') {
    try {
      // Convert filters to query parameters
      const queryParams = {};
      if (filters.coach_id) queryParams.coach_id = filters.coach_id;
      if (filters.client_id) queryParams.client_id = filters.client_id;
      if (filters.status) queryParams.status = filters.status;
      
      return await apiClient.getBookings(queryParams);
    } catch (error) {
      console.error('API filter failed, using fallback:', error);
      const options = {
        where: { ...filters },
        orderBy: { [orderBy]: 'desc' }
      };
      return await db.select('bookings', options);
    }
  },

  async create(bookingData) {
    try {
      return await apiClient.createBooking(bookingData);
    } catch (error) {
      console.error('API create failed, using fallback:', error);
      return await db.insert('bookings', bookingData);
    }
  },

  async update(id, updateData) {
    try {
      return await apiClient.updateBooking(id, updateData);
    } catch (error) {
      console.error('API update failed, using fallback:', error);
      await db.update('bookings', { where: { id } }, updateData);
      return await this.get(id);
    }
  },

  async delete(id) {
    try {
      await apiClient.deleteBooking(id);
    } catch (error) {
      console.error('API delete failed, using fallback:', error);
      await db.delete('bookings', { where: { id } });
    }
  }
};

// ========== MESSAGE ENTITY (Migrated to API) ==========
export const Message = {
  async filter(filters, orderBy = 'created_date') {
    try {
      if (!filters.booking_id) {
        throw new Error('booking_id is required');
      }
      return await apiClient.getMessages(filters.booking_id);
    } catch (error) {
      console.error('API filter failed, using fallback:', error);
      const options = {
        where: { ...filters },
        orderBy: { [orderBy]: 'asc' }
      };
      return await db.select('messages', options);
    }
  },

  async create(messageData) {
    try {
      return await apiClient.sendMessage(messageData);
    } catch (error) {
      console.error('API create failed, using fallback:', error);
      return await db.insert('messages', messageData);
    }
  },

  async update(id, updateData) {
    try {
      return await apiClient.markMessageRead(id);
    } catch (error) {
      console.error('API update failed, using fallback:', error);
      await db.update('messages', { where: { id } }, updateData);
      const messages = await db.select('messages', { where: { id } });
      return messages[0];
    }
  }
};

// ========== ENTITIES STILL USING DIRECT DB ==========
// These will be migrated in future updates

export const Review = {
  async filter(filters, orderBy = 'created_date') {
    const options = {
      where: { ...filters },
      orderBy: { [orderBy]: 'desc' }
    };
    return await db.select('reviews', options);
  },

  async create(reviewData) {
    return await db.insert('reviews', reviewData);
  }
};

export const Payment = {
  async filter(filters) {
    const options = { where: { ...filters } };
    return await db.select('payments', options);
  },

  async create(paymentData) {
    return await db.insert('payments', paymentData);
  },

  async update(id, updateData) {
    await db.update('payments', { where: { id } }, updateData);
    const payments = await db.select('payments', { where: { id } });
    return payments[0];
  }
};

export const SessionDispute = {
  async filter(filters) {
    const options = { where: { ...filters } };
    return await db.select('session_disputes', options);
  },

  async create(disputeData) {
    return await db.insert('session_disputes', disputeData);
  },

  async update(id, updateData) {
    await db.update('session_disputes', { where: { id } }, updateData);
    const disputes = await db.select('session_disputes', { where: { id } });
    return disputes[0];
  }
};

export const CoachAvailability = {
  async getByCoachId(coachId) {
    const availabilities = await db.select('coach_availability', {
      where: { coach_id: coachId },
      orderBy: { start_date: 'asc' }
    });
    return availabilities || [];
  },

  async create(availabilityData) {
    return await db.insert('coach_availability', availabilityData);
  },

  async update(id, updateData) {
    await db.update('coach_availability', { where: { id } }, updateData);
    const availabilities = await db.select('coach_availability', { where: { id } });
    return availabilities[0];
  },

  async delete(id) {
    await db.delete('coach_availability', { where: { id } });
  }
};

export const CoachRecurringAvailability = {
  async getByCoachId(coachId) {
    const recurring = await db.select('coach_recurring_availability', {
      where: { coach_id: coachId },
      orderBy: { day_of_week: 'asc' }
    });
    return recurring || [];
  },

  async create(recurringData) {
    return await db.insert('coach_recurring_availability', recurringData);
  },

  async update(id, updateData) {
    await db.update('coach_recurring_availability', { where: { id } }, updateData);
    const recurring = await db.select('coach_recurring_availability', { where: { id } });
    return recurring[0];
  },

  async delete(id) {
    await db.delete('coach_recurring_availability', { where: { id } });
  }
};
