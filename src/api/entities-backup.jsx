import { db, auth } from './databaseClient';

// User entity with authentication
export const User = {
  async me() {
    const { data: { user }, error } = await auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Not authenticated');

    // Get user profile data
    const profiles = await db.select('profiles', { where: { id: user.id } });
    let profile = profiles[0];

    // If profile doesn't exist, create a basic one
    if (!profile) {
      const newProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
        user_type: 'user', // Default to user
        role: 'user', // Default role
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      profile = await db.insert('profiles', newProfile);
    }

    return {
      id: user.id,
      email: user.email,
      ...profile
    };
  },

  async list() {
    const data = await db.select('profiles', {
      orderBy: { created_at: 'desc' },
      limit: 1000
    });
    return data || [];
  },

  async get(id) {
    const profiles = await db.select('profiles', { where: { id } });
    if (profiles.length === 0) {
      throw new Error('Profile not found');
    }
    return profiles[0];
  },

  async filter(filters) {
    const options = { where: {} };
    
    if (filters.id?.in) {
      // Handle IN queries manually for now
      const placeholders = filters.id.in.map((_, i) => `$${i + 1}`).join(', ');
      const query = `SELECT * FROM profiles WHERE id IN (${placeholders})`;
      return await db.query(query, filters.id.in);
    }
    
    if (filters.user_type) {
      options.where.user_type = filters.user_type;
    }
    
    return await db.select('profiles', options);
  },

  async updateMyUserData(userData) {
    const { data: { user }, error: authError } = await auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Not authenticated');

    // Prepare data for upsert, handling the 'location' field
    const dataToUpsert = {
      id: user.id,
      email: user.email,
      ...userData,
      updated_at: new Date().toISOString()
    };

    // If location is an object, extract the address string
    if (typeof dataToUpsert.location === 'object' && dataToUpsert.location !== null && 'address' in dataToUpsert.location) {
      dataToUpsert.location = dataToUpsert.location.address;
    }

    await db.upsert('profiles', dataToUpsert);
  },

  async login() {
    // Check if Google Client ID is configured
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file. See GOOGLE_OAUTH_SETUP.md for instructions.');
    }

    // Initialize Google OAuth if not already done
    if (!window.google) {
      throw new Error('Google Identity Services not loaded. Please refresh the page.');
    }

    return new Promise((resolve, reject) => {
      window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile',
        callback: async (response) => {
          if (response.error) {
            reject(new Error(`Google OAuth error: ${response.error}`));
            return;
          }

          try {
            // Get user info from Google
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            });
            
            if (!userInfoResponse.ok) {
              throw new Error('Failed to get user info from Google');
            }

            const googleUser = await userInfoResponse.json();
            
            // Check if user exists in our database
            const existingUsers = await db.select('profiles', { where: { email: googleUser.email } });
            
            let user;
            if (existingUsers.length > 0) {
              // User exists, log them in
              user = existingUsers[0];
            } else {
              // Create new user
              const newUser = {
                id: crypto.randomUUID(),
                email: googleUser.email,
                first_name: googleUser.given_name || '',
                last_name: googleUser.family_name || '',
                full_name: googleUser.name || '',
                user_type: 'client', // Default for new Google users
                role: 'user',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              await db.insert('profiles', newUser);
              user = newUser;
            }

            // Set as current user
            await auth.setCurrentUser({ id: user.id, email: user.email });
            resolve({ user: auth.currentUser });
          } catch (error) {
            reject(error);
          }
        }
      }).requestAccessToken();
    });
  },

  async loginWithRedirect(redirectUrl) {
    await this.login();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
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
      delete profileData.password; // Remove password from profile data
      
      // Handle location field
      if (typeof profileData.location === 'object' && profileData.location !== null && 'address' in profileData.location) {
        profileData.location = profileData.location.address;
      }
      
      // For profiles table, role must be 'user' or 'admin' (based on constraint)
      // Use 'user' for both coaches and regular users in profiles
      const profileRole = 'user';
      
      // For users table, role can be 'coach' or 'user'
      const userRole = profileData.user_type === 'coach' ? 'coach' : 'user';
      
      const newProfile = {
        id: userId,
        email: email,
        full_name: profileData.full_name,
        user_type: profileData.user_type,
        location: profileData.location,
        skills: profileData.skills || [],
        bio: profileData.bio,
        phone: profileData.phone,
        role: profileRole,
        preferred_coaching_types: profileData.preferred_coaching_types || [],
        preferred_session_times: profileData.preferred_session_times || [],
        coach_profile: profileData.coach_profile || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Insert profile using direct SQL to handle arrays properly
      await db.query(`
        INSERT INTO profiles (
          id, email, full_name, user_type, location, skills, bio, phone, role,
          preferred_coaching_types, preferred_session_times, coach_profile,
          is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
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
        newProfile.is_active,
        newProfile.created_at,
        newProfile.updated_at
      ]);
      
      // Also insert into users table for consistency
      await db.query(`
        INSERT INTO users (id, email, full_name, role, phone, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        email,
        profileData.full_name,
        userRole,
        profileData.phone,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      
      // Set the user as authenticated
      await auth.setCurrentUser({ id: userId, email: email });

      // Send notifications asynchronously (don't block the user)
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

      // Send failure notifications asynchronously
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
      // Basic email validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Find user by email
      const profiles = await db.select('profiles', { where: { email } });
      if (profiles.length === 0) {
        throw new Error('Invalid email or password');
      }
      
      // For now, accept any password for existing users
      // In production, you'd validate against a hashed password
      const user = profiles[0];
      await auth.setCurrentUser({ id: user.id, email: user.email });

      // Log successful signin (non-blocking)
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

      // Log failed signin (non-blocking)
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

  async logout() {
    return await auth.signOut();
  },

  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch {
      return false;
    }
  }
};

// Booking entity
export const Booking = {
  async list(orderBy = '-created_at', limit = 100) {
    const options = { limit };
    
    if (orderBy.startsWith('-')) {
      options.orderBy = { [orderBy.substring(1)]: 'desc' };
    } else {
      options.orderBy = { [orderBy]: 'asc' };
    }
    
    return await db.select('bookings', options);
  },

  async filter(filters, orderBy = 'created_at') {
    const where = {};
    
    if (filters.coach_id) {
      where.coach_id = filters.coach_id;
    }
    
    if (filters.client_id) {
      where.client_id = filters.client_id;
    }
    
    // Handle OR conditions manually for now
    if (filters.OR) {
      const orConditions = filters.OR;
      if (orConditions.length === 2 && orConditions[0].client_id && orConditions[1].coach_id) {
        const query = `
          SELECT * FROM bookings 
          WHERE client_id = $1 OR coach_id = $2
          ORDER BY ${orderBy.startsWith('-') ? orderBy.substring(1) + ' DESC' : orderBy + ' ASC'}
        `;
        return await db.query(query, [orConditions[0].client_id, orConditions[1].coach_id]);
      }
    }
    
    const options = { where };
    if (orderBy.startsWith('-')) {
      options.orderBy = { [orderBy.substring(1)]: 'desc' };
    } else {
      options.orderBy = { [orderBy]: 'asc' };
    }
    
    return await db.select('bookings', options);
  },

  async get(id) {
    const bookings = await db.select('bookings', { where: { id } });
    if (bookings.length === 0) {
      throw new Error('Booking not found');
    }
    return bookings[0];
  },

  async create(bookingData) {
    const { session_date, session_time, duration, location, ...rest } = bookingData;

    // Generate unique reference code
    const { generateBookingReference } = await import('../utils/booking-reference.js');
    let referenceCode = generateBookingReference();
    
    // Ensure reference code is unique (retry if collision)
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.select('bookings', { where: { reference_code: referenceCode } });
      if (existing.length === 0) break;
      referenceCode = generateBookingReference();
      attempts++;
    }

    // Ensure session_date is in YYYY-MM-DD format
    let formattedDate = session_date;
    if (session_date instanceof Date) {
      formattedDate = session_date.toISOString().split('T')[0];
    }
    // Combine date and time to create booking_date
    const startDateTimeString = `${formattedDate}T${session_time}:00`;
    const bookingDate = new Date(startDateTimeString);

    // Handle location object - flatten it for database storage
    const locationData = location || {};
    const flattenedData = {
      ...rest,
      reference_code: referenceCode,
      booking_date: bookingDate.toISOString(),
      duration: duration,
      location_type: locationData.type || 'online',
      location_address: locationData.address || null,
      location_notes: locationData.notes || null,
      location: locationData.type === 'online' ? 'Online Session' : (locationData.address || 'In-person'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: rest.status || 'pending',
      session_completed_by_user: false,
      session_completed_by_coach: false,
      cancellation_reason: null
    };
    return await db.insert('bookings', flattenedData);
  },

  async update(id, updates) {
    // Special handling for cancellation, completion, and acceptance
    const updateData = { ...updates };
    
    // Remove special flags and updated_at to avoid conflicts with db.update
    delete updateData.accept;
    delete updateData.cancel;
    delete updateData.complete_by_user;
    delete updateData.complete_by_coach;
    delete updateData.updated_at; // db.update handles this automatically
    
    if (updates.accept) {
      updateData.status = 'confirmed';
    }
    if (updates.cancel) {
      updateData.status = 'cancelled';
      updateData.cancellation_reason = updates.cancellation_reason || null;
    }
    if (updates.complete_by_user) {
      updateData.session_completed_by_user = true;
    }
    if (updates.complete_by_coach) {
      updateData.session_completed_by_coach = true;
    }
    // If both user and coach have confirmed, mark as completed for payment
    if (updateData.session_completed_by_user && updateData.session_completed_by_coach) {
      updateData.status = 'completed';
    }
    return await db.update('bookings', id, updateData);
  },

  // Session Management Methods
  async markArrival(bookingId, userId, userRole) {
    const now = new Date().toISOString();
    const updateData = {};
    
    if (userRole === 'client' || userRole === 'user') {
      updateData.client_arrived_at = now;
    } else if (userRole === 'coach') {
      updateData.coach_arrived_at = now;
    }
    
    // If both have arrived, start the session
    const booking = await this.get(bookingId);
    if ((booking.client_arrived_at || updateData.client_arrived_at) && 
        (booking.coach_arrived_at || updateData.coach_arrived_at) && 
        !booking.session_started_at) {
      updateData.session_started_at = now;
      // Keep status as 'confirmed' since 'in_session' is not allowed by current constraint
    }
    
    return await db.update('bookings', bookingId, updateData);
  },

  async markSessionComplete(bookingId, userId, userRole, reason = null) {
    const now = new Date().toISOString();
    const booking = await this.get(bookingId);
    const updateData = {};
    
    if (userRole === 'client' || userRole === 'user') {
      updateData.client_completed_at = now;
    } else if (userRole === 'coach') {
      updateData.coach_completed_at = now;
    }
    
    // Check if completing early (before scheduled end time)
    const sessionStart = new Date(booking.session_started_at || booking.created_at);
    const expectedEnd = new Date(sessionStart.getTime() + (booking.duration * 60 * 60 * 1000));
    const isEarly = new Date() < expectedEnd;
    
    if (isEarly && reason) {
      updateData.early_completion_reason = reason;
    }
    
    // If both have completed, finalize the session
    if ((booking.client_completed_at || updateData.client_completed_at) && 
        (booking.coach_completed_at || updateData.coach_completed_at) && 
        !booking.session_completed_at) {
      updateData.session_completed_at = now;
      updateData.status = 'completed';
      updateData.payment_status = 'pending_release';
      updateData.payment_held_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
    }
    
    return await db.update('bookings', bookingId, updateData);
  },

  async initiateDispute(bookingId, userId, reason) {
    // Create dispute record
    await db.insert('session_disputes', {
      booking_id: bookingId,
      initiated_by: userId,
      dispute_reason: reason,
      status: 'open',
      created_date: new Date().toISOString()
    });
    
    // Update booking status
    return await db.update('bookings', bookingId, {
      dispute_status: 'disputed',
      payment_status: 'on_hold',
      dispute_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours for coach response
    });
  },

  async findByReference(referenceCode) {
    const { validateBookingReference } = await import('../utils/booking-reference.js');
    
    if (!validateBookingReference(referenceCode)) {
      throw new Error('Invalid booking reference format');
    }
    
    const bookings = await db.select('bookings', { where: { reference_code: referenceCode } });
    if (bookings.length === 0) {
      throw new Error('Booking not found');
    }
    return bookings[0];
  },

  async searchByReference(searchTerm) {
    // Support partial searches and different formats
    const cleanTerm = searchTerm.replace(/[-\s]/g, '').toUpperCase();
    
    // Get all bookings and filter client-side to avoid raw SQL in browser
    const allBookings = await this.list('-created_at', 1000);
    
    return allBookings.filter(booking => {
      if (!booking.reference_code) return false;
      const cleanRef = booking.reference_code.replace(/[-\s]/g, '').toUpperCase();
      return cleanRef.includes(cleanTerm);
    }).slice(0, 20);
  },

  // Reschedule methods
  async requestReschedule(bookingId, userId, proposedDate) {
    const booking = await this.get(bookingId);
    
    // Can't reschedule completed or cancelled bookings
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new Error('Cannot reschedule a completed or cancelled booking');
    }
    
    return await db.update('bookings', bookingId, {
      reschedule_requested_by: userId,
      reschedule_proposed_date: proposedDate,
      reschedule_status: 'pending',
      reschedule_requested_at: new Date().toISOString()
    });
  },

  async acceptReschedule(bookingId) {
    const booking = await this.get(bookingId);
    
    if (booking.reschedule_status !== 'pending') {
      throw new Error('No pending reschedule request');
    }
    
    return await db.update('bookings', bookingId, {
      booking_date: booking.reschedule_proposed_date,
      reschedule_status: 'accepted',
      reschedule_requested_by: null,
      reschedule_proposed_date: null
    });
  },

  async declineReschedule(bookingId) {
    const booking = await this.get(bookingId);
    
    if (booking.reschedule_status !== 'pending') {
      throw new Error('No pending reschedule request');
    }
    
    return await db.update('bookings', bookingId, {
      reschedule_status: 'declined',
      reschedule_requested_by: null,
      reschedule_proposed_date: null
    });
  }
};

// Message entity
export const Message = {
  async filter(filters, orderBy = 'created_date') {
    const options = {};
    if (filters.booking_id) {
      if (typeof filters.booking_id === 'object' && filters.booking_id.in) {
        const placeholders = filters.booking_id.in.map((_, i) => `$${i + 1}`).join(', ');
        const query = `
          SELECT * FROM messages 
          WHERE booking_id IN (${placeholders})
          ORDER BY ${orderBy.startsWith('-') ? orderBy.substring(1) + ' DESC' : orderBy + ' ASC'}
        `;
        return await db.query(query, filters.booking_id.in);
      } else {
        options.where = { booking_id: filters.booking_id };
      }
    }
    if (orderBy.startsWith('-')) {
      options.orderBy = { [orderBy.substring(1)]: 'desc' };
    } else {
      options.orderBy = { [orderBy]: 'asc' };
    }
    return await db.select('messages', options);
  },

  async create(messageData) {
    // booking_id is now supported
    return await db.insert('messages', {
      ...messageData,
      created_date: new Date().toISOString()
    });
  },

  async update(id, updates) {
    return await db.update('messages', id, updates);
  }
};

// Review entity
export const Review = {
  async create(reviewData) {
    // Prevent duplicate reviews for the same booking/reviewer/reviewee
    const existing = await db.select('reviews', {
      where: {
        booking_id: reviewData.booking_id,
        reviewer_id: reviewData.reviewer_id,
        reviewee_id: reviewData.reviewee_id
      }
    });
    if (existing.length > 0) {
      throw new Error('Review already exists for this session and reviewer/reviewee.');
    }
    return await db.insert('reviews', {
      ...reviewData,
      created_at: new Date().toISOString()
    });
  }
};

// Payment entity
export const Payment = {
  async create(paymentData) {
    return await db.insert('payments', {
      ...paymentData,
      created_at: new Date().toISOString()
    });
  },

  async getByBookingId(bookingId) {
    const payments = await db.select('payments', { where: { booking_id: bookingId } });
    return payments[0] || null;
  },

  async updateStatus(paymentId, status, additionalData = {}) {
    return await db.update('payments', paymentId, {
      status,
      ...additionalData,
      [`${status}_at`]: new Date().toISOString()
    });
  },

  async releasePayment(paymentId) {
    return await this.updateStatus(paymentId, 'released', {
      released_at: new Date().toISOString()
    });
  },

  async refundPayment(paymentId) {
    return await this.updateStatus(paymentId, 'refunded', {
      refunded_at: new Date().toISOString()
    });
  }
};

// Session Dispute entity
export const SessionDispute = {
  async create(disputeData) {
    return await db.insert('session_disputes', {
      ...disputeData,
      created_at: new Date().toISOString()
    });
  },

  async getByBookingId(bookingId) {
    const disputes = await db.select('session_disputes', { 
      where: { booking_id: bookingId },
      orderBy: { created_at: 'desc' }
    });
    return disputes[0] || null;
  },

  async addCoachResponse(disputeId, response) {
    return await db.update('session_disputes', disputeId, {
      coach_response: response,
      coach_responded_at: new Date().toISOString(),
      status: 'coach_responded'
    });
  },

  async resolve(disputeId, resolution) {
    return await db.update('session_disputes', disputeId, {
      resolution,
      resolved_at: new Date().toISOString(),
      status: 'resolved'
    });
  }
};

// Coach Availability entity
export const CoachAvailability = {
  async create(availabilityData) {
    return await db.insert('coach_availability', {
      ...availabilityData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  async getByCoachId(coachId, startDate = null, endDate = null) {
    const query = `
      SELECT * FROM coach_availability 
      WHERE coach_id = $1
      ${startDate ? 'AND end_date >= $2' : ''}
      ${endDate ? 'AND start_date <= $3' : ''}
      ORDER BY start_date ASC
    `;
    const params = [coachId];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    
    return await db.query(query, params);
  },

  async update(id, updates) {
    return await db.update('coach_availability', id, updates);
  },

  async delete(id) {
    return await db.delete('coach_availability', id);
  },

  // Get coach's current location (check for active override)
  async getCurrentLocation(coachId) {
    const now = new Date().toISOString();
    const query = `
      SELECT location_override FROM coach_availability 
      WHERE coach_id = $1 
        AND start_date <= $2 
        AND end_date >= $2 
        AND location_override IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const results = await db.query(query, [coachId, now]);
    return results[0]?.location_override || null;
  }
};

// Coach Recurring Availability entity
export const CoachRecurringAvailability = {
  async create(recurringData) {
    return await db.insert('coach_recurring_availability', {
      ...recurringData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  async getByCoachId(coachId) {
    return await db.select('coach_recurring_availability', { 
      where: { coach_id: coachId, is_active: true },
      orderBy: { day_of_week: 'asc', start_time: 'asc' }
    });
  },

  async update(id, updates) {
    return await db.update('coach_recurring_availability', id, updates);
  },

  async delete(id) {
    return await db.update('coach_recurring_availability', id, { is_active: false });
  }
};