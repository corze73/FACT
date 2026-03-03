import apiClient from './apiClient';
import { db, auth, sql } from './databaseClient';
const dbAvailable = !!sql && !!db && typeof db.query === 'function';

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

const normalizeUserType = (value) => {
  if (value === 'coach' || value === 'client') return value;
  if (value === 'user' || !value) return 'client';
  return value;
};

const normalizeUserRecord = (user) => {
  if (!user) return user;
  return { ...user, user_type: normalizeUserType(user.user_type) };
};

const normalizeUserList = (list) => (Array.isArray(list) ? list.map(normalizeUserRecord) : list);

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
        ...normalizeUserRecord(profile)
      };
    } catch (apiError) {
      // If API fails, clear invalid cached user and surface a clean state in production
  console.warn('API fetch failed for cached user; clearing session:', apiError?.message || apiError);
  try { await auth.setCurrentUser(null); } catch { /* no-op */ }

      if (!dbAvailable) {
        throw apiError;
      }

      // DEV-ONLY fallback below
      // Get from database directly (dev-only fallback)
      const profiles = await db.select('profiles', { where: { id: user.id } });
      let profile = profiles[0];

      if (!profile) {
        // Create basic profile via API
        const newProfile = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
          role: 'user',
          user_type: 'client',
          is_active: true
        };

        try {
          profile = await apiClient.createUser(newProfile);
        } catch (createError) {
          console.error('Failed to create user via API:', createError);
          if (!dbAvailable) throw createError;
          // Fallback to direct DB (dev only)
          profile = await db.insert('profiles', newProfile);
        }
      }

      return {
        id: user.id,
        email: user.email,
        ...normalizeUserRecord(profile)
      };
    }
  },

  async list() {
    try {
      const data = await apiClient.getUsers();
      return normalizeUserList(data);
    } catch (error) {
      console.error('API list failed, using fallback:', error);
      if (!dbAvailable) throw error;
      // Fallback to direct DB (dev only)
      const data = await db.select('profiles', { orderBy: { created_at: 'desc' }, limit: 1000 });
      return normalizeUserList(data || []);
    }
  },

  async get(id) {
    try {
      const user = await apiClient.getUser(id);
      return normalizeUserRecord(user);
    } catch (error) {
      console.error('API get failed, using fallback:', error);
      if (!dbAvailable) throw error;
      // Fallback to direct DB (dev only)
      const users = await db.select('profiles', { where: { id } });
      if (users.length === 0) throw new Error('User not found');
      return normalizeUserRecord(users[0]);
    }
  },

  async filter(filters) {
    try {
      const queryParams = {};
      if (filters.role) queryParams.role = filters.role;
      if (filters.user_type) queryParams.type = filters.user_type;
      if (filters.id?.in) queryParams.ids = filters.id.in.join(',');
      const users = await apiClient.getUsers(queryParams);
      return normalizeUserList(users);
    } catch (error) {
      console.error('API filter failed, using fallback:', error);
      if (!dbAvailable) throw error;
      // Fallback to direct DB (dev only)
      const options = { where: {} };
      
      if (filters.id?.in) {
        const placeholders = filters.id.in.map((_, i) => `$${i + 1}`).join(', ');
        const query = `SELECT * FROM profiles WHERE id IN (${placeholders})`;
        const rows = await db.query(query, filters.id.in);
        return normalizeUserList(rows);
      }
      
      if (filters.role) {
        options.where.role = filters.role;
      }
      
      const rows = await db.select('profiles', options);
      return normalizeUserList(rows);
    }
  },

  async update(id, userData) {
    try {
      const updated = await apiClient.updateUser(id, userData);
      return normalizeUserRecord(updated);
    } catch (error) {
      console.error('API update failed, using fallback:', error);
      if (!dbAvailable) throw error;
      // Fallback to direct DB (dev only)
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

    const updated = await this.update(user.id, dataToUpdate);

    const hasComplianceFields = [
      'qualification_type',
      'qualification_file_url',
      'has_background_check',
      'background_check_type',
      'background_check_file_url',
      'background_check_expires_at'
    ].some((key) => key in dataToUpdate);

    if (hasComplianceFields) {
      await apiClient.updateCompliance({
        qualification_type: dataToUpdate.qualification_type,
        qualification_file_url: dataToUpdate.qualification_file_url,
        has_background_check: dataToUpdate.has_background_check,
        background_check_type: dataToUpdate.background_check_type,
        background_check_file_url: dataToUpdate.background_check_file_url,
        background_check_expires_at: dataToUpdate.background_check_expires_at
      });
    }

    return updated;
  },

  async signUpWithEmail(email, password, userData) {
    let errorDetails = null;

    try {
      // Check if user already exists
      const existingUsers = await db.select('profiles', { where: { email } });
      if (existingUsers.length > 0) {
        throw new Error('User already registered');
      }

      // Create new user profile
      const userId = crypto.randomUUID();
      const profileData = { ...userData };
      delete profileData.password; // Do not store raw password

      // Handle location field
      if (typeof profileData.location === 'object' && profileData.location !== null && 'address' in profileData.location) {
        profileData.location = profileData.location.address;
      }

      const profileRole = 'user';
      const normalizedUserType = profileData.user_type === 'user' ? 'client' : profileData.user_type;
      const userRole = normalizedUserType === 'coach' ? 'coach' : 'user';

      const now = new Date().toISOString();

      // Ensure users identity row exists before profiles (FK requirement)
      await db.query(`
        INSERT INTO users (id, email, full_name, role, phone, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        email,
        profileData.full_name,
        userRole,
        profileData.phone,
        now,
        now
      ]);

      await db.setUserContext(userId);

      const newProfile = {
        id: userId,
        email,
        full_name: profileData.full_name,
        user_type: normalizedUserType,
        location: profileData.location,
        skills: profileData.skills || [],
        bio: profileData.bio,
        phone: profileData.phone,
        role: profileRole,
        preferred_coaching_types: profileData.preferred_coaching_types || [],
        preferred_session_times: profileData.preferred_session_times || [],
        coach_profile: profileData.coach_profile || null,
        qualification_type: profileData.qualification_type || null,
        qualification_file_url: profileData.qualification_file_url || null,
        qualification_status: profileData.qualification_file_url ? 'pending' : 'incomplete',
        background_check_type: profileData.background_check_type || null,
        has_background_check: Boolean(profileData.has_background_check),
        background_check_file_url: profileData.background_check_file_url || null,
        background_check_status: profileData.background_check_file_url ? 'pending' : 'incomplete',
        background_check_expires_at: profileData.background_check_expires_at || null,
        is_active: true,
        created_at: now,
        updated_at: now
      };

      // Insert profile using direct SQL to handle arrays properly
      await db.query(`
        INSERT INTO profiles (
          id, email, full_name, user_type, location, skills, bio, phone, role,
          preferred_coaching_types, preferred_session_times, coach_profile,
          qualification_type, qualification_file_url, qualification_status,
          background_check_type, has_background_check, background_check_file_url,
          background_check_status, background_check_expires_at,
          is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18,
          $19, $20,
          $21, $22, $23
        )
      `, [
        newProfile.id,
        newProfile.email,
        newProfile.full_name,
        newProfile.user_type,
        newProfile.location,
        newProfile.skills,
        newProfile.bio,
        newProfile.phone,
        newProfile.role,
        newProfile.preferred_coaching_types,
        newProfile.preferred_session_times,
        JSON.stringify(newProfile.coach_profile),
        newProfile.qualification_type,
        newProfile.qualification_file_url,
        newProfile.qualification_status,
        newProfile.background_check_type,
        newProfile.has_background_check,
        newProfile.background_check_file_url,
        newProfile.background_check_status,
        newProfile.background_check_expires_at,
        newProfile.is_active,
        newProfile.created_at,
        newProfile.updated_at
      ]);

      // Mark user as logged in (dev auth)
      await auth.setCurrentUser({ id: userId, email });

      // Fire-and-forget notifications
      setTimeout(async () => {
        try {
          const { AuthNotificationService } = await import('./authLogger.js');
          await AuthNotificationService.handleSignupEvent(
            email,
            profileData.full_name,
            profileData.user_type,
            true
          );
        } catch (notificationError) {
          console.error('Notification error (non-blocking):', notificationError);
        }
      }, 0);

      return { user: auth.currentUser };

    } catch (error) {
      errorDetails = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };

      setTimeout(async () => {
        try {
          const { AuthNotificationService } = await import('./authLogger.js');
          await AuthNotificationService.handleSignupEvent(
            email,
            userData.full_name || 'User',
            userData.user_type || 'user',
            false,
            errorDetails
          );
        } catch (notificationError) {
          console.error('Failure notification error (non-blocking):', notificationError);
        }
      }, 0);

      throw error;
    }
  },

  async signInWithEmail(email, password) {
    let errorDetails = null;

    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const profiles = await db.select('profiles', { where: { email } });
      if (profiles.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = profiles[0];
      await auth.setCurrentUser({ id: user.id, email: user.email });

      setTimeout(async () => {
        try {
          const { AuthNotificationService } = await import('./authLogger.js');
          await AuthNotificationService.handleSigninEvent(email, true);
        } catch (notificationError) {
          console.error('Signin notification error (non-blocking):', notificationError);
        }
      }, 0);

      return { user: auth.currentUser };

    } catch (error) {
      errorDetails = {
        message: error.message,
        timestamp: new Date().toISOString()
      };

      setTimeout(async () => {
        try {
          const { AuthNotificationService } = await import('./authLogger.js');
          await AuthNotificationService.handleSigninEvent(email, false, errorDetails);
        } catch (notificationError) {
          console.error('Signin failure notification error (non-blocking):', notificationError);
        }
      }, 0);

      throw error;
    }
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
              const profile = await apiClient.createUser({
                email: googleUser.email,
                full_name: googleUser.name || '',
                avatar_url: googleUser.picture || null
              });

              if (!profile || !profile.id) {
                // If user already exists (409), try to fetch by email is not possible due to RLS.
                // Ask user to refresh; subsequent app boot may have id in cache or API will allow GET with known id.
                throw new Error(profile?.error || 'Profile creation/login did not return a user id');
              }

              // Set as current user with full profile data + auth token
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
    const result = await this.login();
    try {
      const target = sessionStorage.getItem('authRedirect');
      if (target) {
        sessionStorage.removeItem('authRedirect');
        // Use a hard navigation to ensure app state (auth + DB context) is fully reloaded
        window.location.href = target;
      }
    } catch {
      // no-op; fallback to returning normally
    }
    return result;
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

// Extend User with admin delete helper
User.delete = async function(id, opts = {}) {
  return await apiClient.deleteUser(id, opts);
};

// Request account deletion (user-initiated)
User.requestDeletion = async function(reason) {
  const { data: { user } } = await auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return await apiClient.createDeletionRequest(user.id, reason);
};

// Admin list/decide deletion requests
User.listDeletionRequests = async function(filters = {}) {
  return await apiClient.listDeletionRequests(filters);
};

User.decideDeletionRequest = async function(id, decision, decision_reason, admin_id) {
  return await apiClient.decideDeletionRequest(id, decision, decision_reason, admin_id);
};

User.uploadComplianceFile = async function(file, documentType) {
  return await apiClient.uploadComplianceFile(file, documentType);
};

User.updateCompliance = async function(payload) {
  return await apiClient.updateCompliance(payload);
};

User.listAdminVerifications = async function(filters = {}) {
  return await apiClient.getAdminVerifications(filters);
};

User.updateAdminVerification = async function(coachId, payload = {}) {
  return await apiClient.updateAdminVerification(coachId, payload);
};

// Admin restore user (reactivate)
User.restore = async function(id) {
  return await apiClient.updateUser(id, { is_active: true, deactivated_at: null, deactivation_reason: null });
};

// ========== BOOKING ENTITY (Migrated to API) ==========
export const Booking = {
  async list(orderBy = '-created_at', limit = null, offset = null, includeTotal = false, extraFilters = {}) {
    try {
      let options = {};
      if (typeof orderBy === 'object' && orderBy !== null) {
        options = orderBy;
      } else if (typeof limit === 'object' && limit !== null) {
        options = limit;
      } else {
        options = { orderBy, limit, offset, includeTotal, ...extraFilters };
      }

      const filters = { ...options.filters };
      if (options.orderBy) filters.orderBy = options.orderBy;
      if (options.limit) filters.limit = options.limit;
      if (options.offset !== null && options.offset !== undefined) filters.offset = options.offset;
      if (options.includeTotal) filters.include_total = '1';
      if (options.status) filters.status = options.status;
      if (options.coach_id) filters.coach_id = options.coach_id;
      if (options.client_id) filters.client_id = options.client_id;
      if (options.view) filters.view = options.view;

      // orderBy format: '-created_at' means DESC, 'created_at' means ASC
      return await apiClient.getBookings(filters);
    } catch (error) {
      console.error('API list failed, using fallback:', error);
      if (!dbAvailable) throw error;
      const data = await db.select('bookings', { orderBy: { created_date: 'desc' }, limit: limit || undefined });
      return data || [];
    }
  },

  async get(id) {
    try {
      return await apiClient.getBooking(id);
    } catch (error) {
      console.error('API get failed, using fallback:', error);
      if (!dbAvailable) throw error;
      const bookings = await db.select('bookings', { where: { id } });
      if (bookings.length === 0) throw new Error('Booking not found');
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
      if (!dbAvailable) throw error;
      const options = { where: { ...filters }, orderBy: { [orderBy]: 'desc' } };
      return await db.select('bookings', options);
    }
  },

  async create(bookingData) {
    try {
      return await apiClient.createBooking(bookingData);
    } catch (error) {
      console.error('API create failed, using fallback:', error);
      if (!dbAvailable) throw error;
      return await db.insert('bookings', bookingData);
    }
  },

  async update(id, updateData) {
    try {
      return await apiClient.updateBooking(id, updateData);
    } catch (error) {
      console.error('API update failed, using fallback:', error);
      if (!dbAvailable) throw error;
      await db.update('bookings', { where: { id } }, updateData);
      return await this.get(id);
    }
  },

  async delete(id) {
    try {
      await apiClient.deleteBooking(id);
    } catch (error) {
      console.error('API delete failed, using fallback:', error);
      if (!dbAvailable) throw error;
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
      if (!dbAvailable) throw error;
      const options = { where: { ...filters }, orderBy: { [orderBy]: 'asc' } };
      return await db.select('messages', options);
    }
  },

  async create(messageData) {
    try {
      return await apiClient.sendMessage(messageData);
    } catch (error) {
      console.error('API create failed, using fallback:', error);
      if (!dbAvailable) throw error;
      return await db.insert('messages', messageData);
    }
  },

  async update(id, updateData) {
    try {
      return await apiClient.markMessageRead(id);
    } catch (error) {
      console.error('API update failed, using fallback:', error);
      if (!dbAvailable) throw error;
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
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for reviews.');
    const options = {
      where: { ...filters },
      orderBy: { [orderBy]: 'desc' }
    };
    return await db.select('reviews', options);
  },

  async create(reviewData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for reviews.');
    return await db.insert('reviews', reviewData);
  }
};

export const Payment = {
  async filter(filters) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for payments.');
    const options = { where: { ...filters } };
    return await db.select('payments', options);
  },

  async create(paymentData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for payments.');
    return await db.insert('payments', paymentData);
  },

  async update(id, updateData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for payments.');
    await db.update('payments', { where: { id } }, updateData);
    const payments = await db.select('payments', { where: { id } });
    return payments[0];
  }
};

export const SessionDispute = {
  async filter(filters) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for session disputes.');
    const options = { where: { ...filters } };
    return await db.select('session_disputes', options);
  },

  async create(disputeData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for session disputes.');
    return await db.insert('session_disputes', disputeData);
  },

  async update(id, updateData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for session disputes.');
    await db.update('session_disputes', { where: { id } }, updateData);
    const disputes = await db.select('session_disputes', { where: { id } });
    return disputes[0];
  }
};

export const CoachAvailability = {
  async getByCoachId(coachId) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach availability.');
    const availabilities = await db.select('coach_availability', {
      where: { coach_id: coachId },
      orderBy: { start_date: 'asc' }
    });
    return availabilities || [];
  },

  async create(availabilityData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach availability.');
    return await db.insert('coach_availability', availabilityData);
  },

  async update(id, updateData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach availability.');
    await db.update('coach_availability', { where: { id } }, updateData);
    const availabilities = await db.select('coach_availability', { where: { id } });
    return availabilities[0];
  },

  async delete(id) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach availability.');
    await db.delete('coach_availability', { where: { id } });
  }
};

export const CoachRecurringAvailability = {
  async getByCoachId(coachId) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach recurring availability.');
    const recurring = await db.select('coach_recurring_availability', {
      where: { coach_id: coachId },
      orderBy: { day_of_week: 'asc' }
    });
    return recurring || [];
  },

  async create(recurringData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach recurring availability.');
    return await db.insert('coach_recurring_availability', recurringData);
  },

  async update(id, updateData) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach recurring availability.');
    await db.update('coach_recurring_availability', { where: { id } }, updateData);
    const recurring = await db.select('coach_recurring_availability', { where: { id } });
    return recurring[0];
  },

  async delete(id) {
    if (!dbAvailable) throw new Error('Direct DB access disabled. Implement API route for coach recurring availability.');
    await db.delete('coach_recurring_availability', { where: { id } });
  }
};
