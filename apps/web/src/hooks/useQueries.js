import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/apiClient.js';
import { queryKeys } from '@/lib/queryClient.js';
import { normalizeUserListResponse, normalizeUserRecord } from '@fact/domain';

/**
 * Custom hooks for data fetching with React Query
 * These hooks provide caching, automatic refetching, and optimistic updates
 */

// ========== COACHES ==========

/**
 * Fetch coaches with filters and pagination
 * Cached for 5 minutes, perfect for browsing
 */
export function useCoaches(filters = {}) {
  return useQuery({
    queryKey: queryKeys.coaches(filters),
    queryFn: () => apiClient.getCoaches(filters),
    // Cache for 5 minutes since coach listings don't change frequently
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch single coach details
 */
export function useCoach(coachId) {
  return useQuery({
    queryKey: queryKeys.coach(coachId),
    queryFn: () => apiClient.getCoachById(coachId),
    enabled: !!coachId, // Only run if coachId exists
    staleTime: 10 * 60 * 1000, // 10 minutes - individual coaches change rarely
  });
}

// ========== BOOKINGS ==========

/**
 * Fetch bookings with filters
 */
export function useBookings(filters = {}) {
  return useQuery({
    queryKey: queryKeys.bookings(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.coach_id) params.append('coach_id', filters.coach_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.archived !== undefined) params.append('archived', filters.archived);
      
      const response = await apiClient.getBookings(params.toString());
      return response;
    },
    // Shorter cache for bookings as they update more frequently
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch single booking
 */
export function useBooking(bookingId) {
  return useQuery({
    queryKey: queryKeys.booking(bookingId),
    queryFn: () => apiClient.getBookingById(bookingId),
    enabled: !!bookingId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Create booking mutation with optimistic updates
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (bookingData) => apiClient.createBooking(bookingData),
    onSuccess: () => {
      // Invalidate bookings cache to refetch
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

/**
 * Update booking mutation
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ bookingId, data }) => apiClient.updateBooking(bookingId, data),
    onSuccess: (_, variables) => {
      // Invalidate specific booking and list
      queryClient.invalidateQueries({ queryKey: queryKeys.booking(variables.bookingId) });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// ========== USERS ==========

/**
 * Fetch current user
 */
export function useCurrentUser(userId) {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async () => normalizeUserRecord(await apiClient.getUser(userId)),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    // User data doesn't change often, refetch only on explicit refresh
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch all users (admin)
 */
export function useUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.users({ page, limit }),
    queryFn: async () => {
      const params = new URLSearchParams({ limit, offset: (page - 1) * limit, include_total: '1' });
      const response = await apiClient.getUsers(params.toString());
      return normalizeUserListResponse(response);
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Update user mutation
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, data }) => apiClient.updateUser(userId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.userId) });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}

// ========== MESSAGES ==========

/**
 * Fetch messages for a booking
 */
export function useMessages(bookingId) {
  return useQuery({
    queryKey: queryKeys.messages(bookingId),
    queryFn: () => apiClient.getMessages(bookingId),
    enabled: !!bookingId,
    staleTime: 30 * 1000, // 30 seconds - messages need to be fresher
    refetchInterval: 30 * 1000, // Poll every 30 seconds for new messages
  });
}

/**
 * Send message mutation
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (messageData) => apiClient.sendMessage(messageData),
    onSuccess: (_, variables) => {
      // Invalidate messages for this booking
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.messages(variables.booking_id) 
      });
    },
  });
}

// ========== ADMIN ==========

/**
 * Fetch booking statistics (admin dashboard)
 */
export function useBookingStats() {
  return useQuery({
    queryKey: queryKeys.bookingStats,
    queryFn: () => apiClient.getBookingStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Admin users with pagination
 */
export function useAdminUsers(page = 1) {
  const limit = 20; // Fixed admin page size
  
  return useQuery({
    queryKey: queryKeys.adminUsers(page),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit,
        offset: (page - 1) * limit,
        include_total: '1'
      });
      const response = await apiClient.getUsers(params.toString());
      return normalizeUserListResponse(response);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
