import apiClient from './apiClient';
import { db, auth, sql } from './databaseClient';
import { consumeAuthRedirect, signInWithGoogle, storeAuthRedirect } from '@/auth/browserAuth.js';
import { normalizeUserList, normalizeUserRecord, normalizeUserType } from '@fact/domain';
const dbAvailable = !!sql && !!db && typeof db.query === 'function';

/**
 * MIGRATION WRAPPER
 * This file gradually migrates from direct database access to secure Netlify functions
 * 
 * Status:
 * ✅ User - Migrated to API (auth client still handles local session state)
 * ✅ Booking - Migrated to API
 * ✅ Message - Migrated to API
 * ✅ Review - Migrated to API
 * ⏳ Payment - Still using direct DB (Stripe handles most)
 * ⏳ SessionDispute - Still using direct DB (rare usage)
 * ✅ CoachAvailability - Migrated to API
 * ✅ CoachRecurringAvailability - Migrated to API
 */

const formatBookingTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatLocationType = (value) => {
  if (!value) return 'Online';
  return String(value)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeBookingRecord = (booking) => {
  if (!booking) return booking;

  const bookingDateValue = booking.booking_date ?? booking.session_date ?? null;
  const bookingDate = bookingDateValue ? new Date(bookingDateValue) : null;
  const hasValidBookingDate = bookingDate instanceof Date && !Number.isNaN(bookingDate.getTime());

  return {
    ...booking,
    session_date: booking.session_date ?? bookingDateValue,
    session_time: booking.session_time ?? (hasValidBookingDate ? formatBookingTime(bookingDate) : null),
    location: booking.location ?? {
      type: formatLocationType(booking.location_type),
      address: booking.location_address ?? '',
      notes: booking.location_notes ?? ''
    }
  };
};

const normalizeBookingResult = (result) => {
  if (Array.isArray(result)) {
    return result.map(normalizeBookingRecord);
  }

  if (result && Array.isArray(result.data)) {
    return {
      ...result,
      data: result.data.map(normalizeBookingRecord)
    };
  }

  return normalizeBookingRecord(result);
};

// ========== USER ENTITY (Migrated to API) ==========
export const User = {
  // Auth functions still use auth client (Google OAuth)
  async me() {
    const { data: { user }, error } = await auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('Not authenticated');

    try {
      const profile = await apiClient.getUser(user.id);
      return {
        id: user.id,
        email: user.email,
        ...normalizeUserRecord(profile)
      };
    } catch (apiError) {
      const status = Number(apiError?.status || 0);
      const message = String(apiError?.message || '').toLowerCase();
      const isAuthFailure = status === 401 || message.includes('not authenticated') || message.includes('unauthorized');

      // Clear local auth only for explicit auth failures; keep session on transient network/API errors.
      if (isAuthFailure) {
        console.warn('API fetch failed with auth error; clearing session:', apiError?.message || apiError);
        try { await auth.setCurrentUser(null); } catch { /* no-op */ }
      }
      throw apiError;
    }
  },

  async list() {
    const data = await apiClient.getUsers();
    return normalizeUserList(data);
  },

  async get(id) {
    const user = await apiClient.getUser(id);
    return normalizeUserRecord(user);
  },

  async filter(filters) {
    if (filters?.id?.in && Array.isArray(filters.id.in) && filters.id.in.length === 0) {
      return [];
    }

    const queryParams = {};
    if (filters.role) queryParams.role = filters.role;
    if (filters.user_type) queryParams.type = filters.user_type;
    if (filters.id?.in) queryParams.ids = filters.id.in.join(',');
    const users = await apiClient.getUsers(queryParams);
    return normalizeUserList(Array.isArray(users?.data) ? users.data : users);
  },

  async update(id, userData) {
    const updated = await apiClient.updateUser(id, userData);
    return normalizeUserRecord(updated);
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
      const profileData = { ...userData };
      delete profileData.password; // Do not forward raw password in the profile spread

      // Handle location field
      if (typeof profileData.location === 'object' && profileData.location !== null && 'address' in profileData.location) {
        profileData.location = profileData.location.address;
      }

      const normalizedUserType = normalizeUserType(profileData.user_type);

      const createdUser = await apiClient.createUser({
        auth_mode: 'signup',
        email,
        password,  // backend hashes this; never stored raw
        full_name: profileData.full_name,
        phone: profileData.phone || null,
        user_type: normalizedUserType,
        location: profileData.location || null,
        country: profileData.country || null,
        city: profileData.city || null,
        postcode: profileData.postcode || null,
        bio: profileData.bio || null,
        skills: Array.isArray(profileData.skills) ? profileData.skills : [],
        preferred_coaching_types: Array.isArray(profileData.preferred_coaching_types) ? profileData.preferred_coaching_types : [],
        preferred_session_times: Array.isArray(profileData.preferred_session_times) ? profileData.preferred_session_times : [],
        coach_profile: profileData.coach_profile || null,
        qualification_type: profileData.qualification_type || null,
        qualification_file_url: profileData.qualification_file_url || null,
        has_background_check: Boolean(profileData.has_background_check),
        background_check_type: profileData.background_check_type || null,
        background_check_file_url: profileData.background_check_file_url || null,
        background_check_expires_at: profileData.background_check_expires_at || null,
        date_of_birth: profileData.date_of_birth || null,
        terms_accepted: profileData.terms_accepted === true,
        privacy_acknowledged: profileData.privacy_acknowledged === true,
        adult_account_confirmed: profileData.adult_account_confirmed === true,
        policy_version: profileData.policy_version || null
      });

      // Mark user as logged in and persist token for API auth.
      await auth.setCurrentUser({
        id: createdUser.id,
        email: createdUser.email,
        full_name: createdUser.full_name,
        user_type: createdUser.user_type,
        role: createdUser.role,
        token: createdUser.token
      });

      return { user: auth.currentUser };
  },

  async signInWithEmail(email, password) {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const signedInUser = await apiClient.createUser({
        auth_mode: 'signin',
        email,
        password  // backend verifies against stored hash
      });

      await auth.setCurrentUser({
        id: signedInUser.id,
        email: signedInUser.email,
        full_name: signedInUser.full_name,
        user_type: signedInUser.user_type,
        role: signedInUser.role,
        token: signedInUser.token
      });

      return { user: auth.currentUser };
  },

  // Auth functions use Google OAuth + custom auth object
  async login() {
    return signInWithGoogle();
  },

  async logout() {
    const { error } = await auth.signOut();
    if (error) throw error;
  },

  async loginWithRedirect(redirectUrl) {
    storeAuthRedirect(redirectUrl);
    const result = await this.login();
    const target = consumeAuthRedirect();
    if (target) {
      // Use a hard navigation to ensure app state (auth + DB context) is fully reloaded
      window.location.href = target;
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

User.listAdminAuditLogs = async function(filters = {}) {
  return await apiClient.getAdminAuditLogs(filters);
};

User.listAdminDeletedMessages = async function(filters = {}) {
  return await apiClient.getAdminDeletedMessages(filters);
};

User.getAdminOpsOverview = async function() {
  return await apiClient.getAdminOpsOverview();
};

User.listAdminUsersOps = async function(filters = {}) {
  return await apiClient.getAdminUsersOps(filters);
};

User.updateAdminUserScope = async function(adminUserId, payload = {}) {
  return await apiClient.updateAdminUserScope(adminUserId, payload);
};

User.promoteAdminUser = async function(payload = {}) {
  return await apiClient.promoteAdminUser(payload);
};

User.revokeSessions = async function(userId) {
  return await apiClient.revokeUserSessions(userId);
};

User.listAdminCases = async function(filters = {}) {
  return await apiClient.listAdminCases(filters);
};

User.createAdminCase = async function(payload = {}) {
  return await apiClient.createAdminCase(payload);
};

User.updateAdminCase = async function(caseId, payload = {}) {
  return await apiClient.updateAdminCase(caseId, payload);
};

User.submitSafeguardingReport = async function(payload = {}) {
  return await apiClient.submitSafeguardingReport(payload);
};

User.listBookingDisputes = async function(filters = {}) {
  return await apiClient.listBookingDisputes(filters);
};

User.createBookingDispute = async function(payload = {}) {
  return await apiClient.createBookingDispute(payload);
};

User.updateBookingDispute = async function(disputeId, payload = {}) {
  return await apiClient.updateBookingDispute(disputeId, payload);
};

User.listComplianceExpiring = async function(filters = {}) {
  return await apiClient.listComplianceExpiring(filters);
};

User.getWeeklyOpsReport = async function() {
  return await apiClient.getWeeklyOpsReport();
};

User.exportAuditLogs = async function(filters = {}) {
  return await apiClient.exportAuditLogs(filters);
};

User.listDeletedUserSnapshots = async function(filters = {}) {
  return await apiClient.listDeletedUserSnapshots(filters);
};

User.listAuthLogs = async function(filters = {}) {
  return await apiClient.listAuthLogs(filters);
};

User.getAuthLogStats = async function(timeframe = '7 days') {
  return await apiClient.getAuthLogStats(timeframe);
};

User.listAdminInvites = async function(filters = {}) {
  return await apiClient.listAdminInvites(filters);
};

User.createAdminInvite = async function(payload = {}) {
  return await apiClient.createAdminInvite(payload);
};

User.revokeAdminInvite = async function(inviteId) {
  return await apiClient.revokeAdminInvite(inviteId);
};

User.verifyAdminInvite = async function(token) {
  return await apiClient.verifyAdminInvite(token);
};

User.acceptAdminInvite = async function(payload = {}) {
  const response = await apiClient.acceptAdminInvite(payload);
  const acceptedUser = response?.data || response;
  if (acceptedUser?.id && acceptedUser?.email && acceptedUser?.token) {
    await auth.setCurrentUser({
      id: acceptedUser.id,
      email: acceptedUser.email,
      full_name: acceptedUser.full_name,
      user_type: acceptedUser.user_type,
      role: acceptedUser.role,
      admin_scope: acceptedUser.admin_scope,
      token: acceptedUser.token
    });
  }
  return acceptedUser;
};

// Admin restore user (reactivate)
User.restore = async function(id) {
  return await apiClient.updateUser(id, { is_active: true, deactivated_at: null, deactivation_reason: null });
};

// -------------------------------------------------------------------------
// Password management
// -------------------------------------------------------------------------
User.changePassword = async function(currentPassword, newPassword) {
  const result = await apiClient.changePassword({ currentPassword, newPassword });
  // Update the stored token so subsequent requests use the refreshed session
  if (result?.token) {
    const current = auth.currentUser;
    if (current) {
      await auth.setCurrentUser({ ...current, token: result.token });
    }
  }
  return result;
};

User.forgotPassword = async function(email) {
  return await apiClient.forgotPassword({ email });
};

User.resetPassword = async function(token, newPassword) {
  const result = await apiClient.resetPassword({ token, newPassword });
  // A password reset revokes every existing session. Keep this browser signed
  // out too, so the user must authenticate again with the new password.
  await auth.signOut();
  return result;
};

// ========== BOOKING ENTITY (Migrated to API) ==========
export const Booking = {
  async list(orderBy = '-created_at', limit = null, offset = null, includeTotal = false, extraFilters = {}) {
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
    if (options.limit) {
      const parsedLimit = Number(options.limit);
      if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
        filters.limit = Math.min(parsedLimit, 50);
      }
    }
    if (options.offset !== null && options.offset !== undefined) filters.offset = options.offset;
    if (options.includeTotal) filters.include_total = '1';
    if (options.status) filters.status = options.status;
    if (options.coach_id) filters.coach_id = options.coach_id;
    if (options.client_id) filters.client_id = options.client_id;
    if (options.view) filters.view = options.view;

    return normalizeBookingResult(await apiClient.getBookings(filters));
  },

  async get(id) {
    return normalizeBookingRecord(await apiClient.getBooking(id));
  },

  async filter(filters, orderBy = 'created_date') {
    const queryParams = {};
    if (filters.coach_id) queryParams.coach_id = filters.coach_id;
    if (filters.client_id) queryParams.client_id = filters.client_id;
    if (filters.status) queryParams.status = filters.status;
    if (orderBy) queryParams.orderBy = orderBy;

    return normalizeBookingResult(await apiClient.getBookings(queryParams));
  },

  async create(bookingData) {
    return normalizeBookingRecord(await apiClient.createBooking(bookingData));
  },

  async update(id, updateData) {
    return normalizeBookingRecord(await apiClient.updateBooking(id, updateData));
  },

  async cancel(id, reason) {
    return normalizeBookingRecord(await apiClient.cancelBookingPaymentAware(id, reason));
  },

  async releasePayout(id) {
    return await apiClient.releaseCoachPayout(id);
  },

  async processNoShow(id, type) {
    return await apiClient.processBookingNoShow(id, type);
  },

  async delete(id) {
    await apiClient.deleteBooking(id);
  },

  async markArrival(id) {
    return normalizeBookingRecord(await apiClient.bookingAction(id, 'arrival'));
  },

  async markSessionComplete(id, _userId, _userRole, reason = null) {
    return normalizeBookingRecord(await apiClient.bookingAction(id, 'complete', { reason }));
  },

  async initiateDispute(id, _userId, reason) {
    return normalizeBookingRecord(await apiClient.bookingAction(id, 'dispute', { reason }));
  }
};

// ========== MESSAGE ENTITY (Migrated to API) ==========
export const Message = {
  async filter(filters, orderBy = 'created_date') {
    if (!filters.booking_id) {
      throw new Error('booking_id is required');
    }

    if (typeof filters.booking_id === 'object' && Array.isArray(filters.booking_id.in)) {
      const bookingIds = filters.booking_id.in.filter(Boolean);
      if (!bookingIds.length) return [];

      const messageLists = await Promise.all(
        bookingIds.map((bookingId) => apiClient.getMessages(bookingId))
      );

      const merged = messageLists.flat();
      const direction = String(orderBy || 'created_date').startsWith('-') ? -1 : 1;
      return merged.sort((a, b) => {
        const aTs = new Date(a?.created_date || 0).getTime();
        const bTs = new Date(b?.created_date || 0).getTime();
        return direction * (aTs - bTs);
      });
    }

    return await apiClient.getMessages(filters.booking_id);
  },

  async create(messageData) {
    return await apiClient.sendMessage(messageData);
  },

  async update(id, updateData) {
    if (updateData?.is_read === true || Object.keys(updateData || {}).length === 0) {
      return await apiClient.markMessageRead(id);
    }
    throw new Error('Only read-status updates are supported for messages through the API');
  },

  async delete(id) {
    return await apiClient.deleteMessage(id);
  },

  async clearConversation(params = {}) {
    return await apiClient.clearConversationMessages(params);
  },

  async listDeleted(filters = {}) {
    try {
      return await apiClient.listDeletedMessages(filters);
    } catch (error) {
      console.error('API list deleted messages failed:', error);
      throw error;
    }
  },

  async permanentlyDeleteArchived(id) {
    try {
      return await apiClient.permanentlyDeleteArchivedMessage(id);
    } catch (error) {
      console.error('API permanent delete archived message failed:', error);
      throw error;
    }
  },

  async restoreArchived(id) {
    try {
      return await apiClient.restoreArchivedMessage(id);
    } catch (error) {
      console.error('API restore archived message failed:', error);
      throw error;
    }
  }
};

// ========== ENTITIES STILL USING DIRECT DB ==========
// These will be migrated in future updates

export const Review = {
  async filter(filters, orderBy = 'created_date') {
    const queryParams = { ...filters };
    if (orderBy) queryParams.orderBy = orderBy;
    return await apiClient.getReviews(queryParams);
  },

  async create(reviewData) {
    return await apiClient.createReview(reviewData);
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
    return await apiClient.getCoachAvailability({ coach_id: coachId });
  },

  async create(availabilityData) {
    return await apiClient.createCoachAvailability(availabilityData);
  },

  async update(id, updateData) {
    return await apiClient.updateCoachAvailability(id, updateData);
  },

  async delete(id) {
    return await apiClient.deleteCoachAvailability(id);
  }
};

export const CoachRecurringAvailability = {
  async getByCoachId(coachId) {
    return await apiClient.getCoachRecurringAvailability({ coach_id: coachId });
  },

  async create(recurringData) {
    return await apiClient.createCoachRecurringAvailability(recurringData);
  },

  async update(id, updateData) {
    return await apiClient.updateCoachRecurringAvailability(id, updateData);
  },

  async delete(id) {
    return await apiClient.deleteCoachRecurringAvailability(id);
  }
};
