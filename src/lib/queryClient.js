import { QueryClient } from '@tanstack/react-query';

/**
 * React Query configuration
 * Optimized for FACT app with aggressive caching for coach browsing
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is still fresh
      refetchOnMount: false,
      // For better UX, show stale data while refetching
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  // Coaches
  coaches: (filters = {}) => ['coaches', filters],
  coach: (id) => ['coach', id],
  
  // Bookings
  bookings: (filters = {}) => ['bookings', filters],
  booking: (id) => ['booking', id],
  bookingStats: ['bookings', 'stats'],
  
  // Users
  users: (filters = {}) => ['users', filters],
  user: (id) => ['user', id],
  currentUser: ['user', 'current'],
  
  // Messages
  messages: (bookingId) => ['messages', bookingId],
  
  // Admin
  adminUsers: (page) => ['admin', 'users', { page }],
  adminBookings: (filters = {}) => ['admin', 'bookings', filters],
  
  // Analytics
  analytics: (period) => ['analytics', period],
};

/**
 * Cache invalidation helpers
 */
export const invalidateQueries = {
  coaches: () => queryClient.invalidateQueries({ queryKey: ['coaches'] }),
  bookings: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  users: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  messages: (bookingId) => 
    queryClient.invalidateQueries({ queryKey: ['messages', bookingId] }),
  all: () => queryClient.invalidateQueries(),
};
