import { supabase } from './supabaseClient';

// User entity with authentication
export const User = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Not authenticated');

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // If profile doesn't exist, create a basic one
    if (profileError && profileError.code === 'PGRST116') {
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

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) throw createError;
      
      return {
        id: user.id,
        email: user.email,
        ...createdProfile
      };
    } else if (profileError) {
      throw profileError;
    }

    return {
      id: user.id,
      email: user.email,
      ...profile
    };
  },

  async list() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async filter(filters) {
    let query = supabase.from('profiles').select('*');
    
    if (filters.id?.in) {
      query = query.in('id', filters.id.in);
    }
    
    if (filters.user_type) {
      query = query.eq('user_type', filters.user_type);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateMyUserData(userData) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
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

  const { error } = await supabase
    .from('profiles')
    .upsert(dataToUpsert);

  if (error) throw error;
},

  async login() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  },

  async loginWithRedirect(redirectUrl) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    if (error) throw error;
  },

  async signUpWithEmail(email, password, userData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.full_name
        }
      }
    });
    
    if (error) throw error;
    
    // If user is created, also create/update their profile
    if (data.user) {
  const { password, ...profileData } = userData; // Exclude password from profileData
  await this.updateMyUserData({
    ...profileData, // Pass the filtered data
    email: data.user.email,
    id: data.user.id
  });
}
    
    return data;
  },

  async signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch (error) {
      return false;
    }
  }
};

// Booking entity
export const Booking = {
  async list(orderBy = '-created_at', limit = 100) {
    let query = supabase.from('bookings').select('*');
    
    if (orderBy.startsWith('-')) {
      query = query.order(orderBy.substring(1), { ascending: false });
    } else {
      query = query.order(orderBy, { ascending: true });
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async filter(filters, orderBy = 'created_at') {
    let query = supabase.from('bookings').select('*');
    
    if (filters.coach_id) {
      query = query.eq('coach_id', filters.coach_id);
    }
    
    if (filters.client_id) {
      query = query.eq('client_id', filters.client_id);
    }
    
    if (filters.OR) {
      // Handle OR conditions for client_id or coach_id
      const orConditions = filters.OR;
      if (orConditions.length === 2 && orConditions[0].client_id && orConditions[1].coach_id) {
        query = query.or(`client_id.eq.${orConditions[0].client_id},coach_id.eq.${orConditions[1].coach_id}`);
      }
    }
    
    if (orderBy.startsWith('-')) {
      query = query.order(orderBy.substring(1), { ascending: false });
    } else {
      query = query.order(orderBy, { ascending: true });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async create(bookingData) {
    const { session_date, session_time, duration, ...rest } = bookingData;

    // Ensure session_date is in YYYY-MM-DD format
    let formattedDate = session_date;
    if (session_date instanceof Date) {
      formattedDate = session_date.toISOString().split('T')[0];
    }
    
    // Combine date and time to create start_time
    const startDateTimeString = `${formattedDate}T${session_time}:00`; // e.g., "2025-09-10T09:00:00"
    const startTime = new Date(startDateTimeString);

    // Calculate end_time by adding duration minutes
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    // Debug logging
    console.log('Creating booking with data:', {
      ...rest,
      session_date: formattedDate,
      session_time: session_time,
      duration: duration,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    });
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...rest, // other booking data
        session_date: formattedDate, // Store the date separately
        session_time: session_time, // Store the time separately
        duration: duration, // Store duration
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    console.log('Booking created successfully:', data);
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Message entity
export const Message = {
  async filter(filters, orderBy = 'created_date') {
    let query = supabase.from('messages').select('*');
    
    if (filters.booking_id) {
      if (typeof filters.booking_id === 'object' && filters.booking_id.in) {
        query = query.in('booking_id', filters.booking_id.in);
      } else {
        query = query.eq('booking_id', filters.booking_id);
      }
    }
    
    if (orderBy.startsWith('-')) {
      query = query.order(orderBy.substring(1), { ascending: false });
    } else {
      query = query.order(orderBy, { ascending: true });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(messageData) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...messageData,
        created_date: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Review entity
export const Review = {
  async create(reviewData) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...reviewData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};