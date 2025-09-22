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
    // Mock login - you'll need to implement proper Google OAuth
    // For now, this simulates a Google login process
    throw new Error('Google authentication not implemented yet. Please use email login.');
  },

  async loginWithRedirect(redirectUrl) {
    await this.login();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  async signUpWithEmail(email, password, userData) {
    // Mock signup - you'll need to implement proper auth
    const userId = crypto.randomUUID();
    const user = { id: userId, email };
    
    // Create profile (password handling would be implemented in production)
    const profileData = { ...userData };
    delete profileData.password; // Remove password from profile data
    await this.updateMyUserData({
      ...profileData,
      email: user.email,
      id: user.id
    });
    
    return { user };
  },

  async signInWithEmail(email, password) {
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
    return { user: auth.currentUser };
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
    const { session_date, session_time, duration, ...rest } = bookingData;

    // Ensure session_date is in YYYY-MM-DD format
    let formattedDate = session_date;
    if (session_date instanceof Date) {
      formattedDate = session_date.toISOString().split('T')[0];
    }
    
    // Combine date and time to create booking_date
    const startDateTimeString = `${formattedDate}T${session_time}:00`;
    const bookingDate = new Date(startDateTimeString);

    console.log('Creating booking with data:', {
      ...rest,
      booking_date: bookingDate.toISOString(),
      duration: duration
    });

    return await db.insert('bookings', {
      ...rest,
      booking_date: bookingDate.toISOString(),
      duration: duration,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  async update(id, updates) {
    return await db.update('bookings', id, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  }
};

// Message entity
export const Message = {
  async filter(filters, orderBy = 'created_date') {
    const options = {};
    
    if (filters.booking_id) {
      if (typeof filters.booking_id === 'object' && filters.booking_id.in) {
        // Handle IN queries manually
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
    return await db.insert('reviews', {
      ...reviewData,
      created_at: new Date().toISOString()
    });
  }
};