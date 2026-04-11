import type { APIClient } from '../client/createClient';

export const attachEndpoints = (client: APIClient) => {
  Object.assign(client, {
    getUser(id: string) {
      return client.request(`/users/${id}`);
    },
    getCoaches(filters: Record<string, unknown> | string = {}) {
      if (typeof filters === 'string') {
        const query = filters ? `?${filters}` : '?role=coach';
        return client.request(`/users${query}`);
      }
      const params = client.buildQueryParams({ role: 'coach', ...filters });
      return client.request(`/users?${params}`);
    },
    getCoachById(id: string) {
      return client.request(`/users/${id}`);
    },
    createDeletionRequest(userId: string, reason: string) {
      return client.request('/account-deletion-requests', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, reason }),
      });
    },
    listDeletionRequests(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/account-deletion-requests?${params}`);
    },
    decideDeletionRequest(id: string, decision: string, decision_reason: string, admin_id: string) {
      return client.request('/account-deletion-requests', {
        method: 'PUT',
        body: JSON.stringify({ id, decision, decision_reason, admin_id }),
      });
    },
    getUsers(filters: Record<string, unknown> | string = {}) {
      if (typeof filters === 'string') {
        const query = filters ? `?${filters}` : '';
        return client.request(`/users${query}`);
      }
      const params = client.buildQueryParams(filters);
      return client.request(`/users?${params}`);
    },
    createUser(userData: unknown) {
      return client.request('/users', { method: 'POST', body: JSON.stringify(userData) });
    },
    updateUser(id: string, userData: unknown) {
      return client.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) });
    },
    deleteUser(id: string, options: Record<string, unknown> = {}) {
      const { reason, hard, confirmation_phrase, second_admin_id } = options;
      const req: RequestInit = { method: 'DELETE' };
      if (reason || hard || confirmation_phrase || second_admin_id) {
        req.body = JSON.stringify({ reason, hard, confirmation_phrase, second_admin_id });
      }
      return client.request(`/users/${id}`, req);
    },
    getBooking(id: string) {
      return client.request(`/bookings/${id}`);
    },
    getBookingById(id: string) {
      return client.request(`/bookings/${id}`);
    },
    getBookings(filters: Record<string, unknown> | string = {}) {
      if (typeof filters === 'string') {
        const query = filters ? `?${filters}` : '';
        return client.request(`/bookings${query}`);
      }
      const params = client.buildQueryParams(filters);
      return client.request(`/bookings?${params}`);
    },
    getBookingStats() {
      return client.request('/bookings?stats=1');
    },
    createBooking(bookingData: unknown) {
      return client.request('/bookings', { method: 'POST', body: JSON.stringify(bookingData) });
    },
    updateBooking(id: string, bookingData: unknown) {
      return client.request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(bookingData) });
    },
    deleteBooking(id: string) {
      return client.request(`/bookings/${id}`, { method: 'DELETE' });
    },
    getMessages(bookingId: string) {
      return client.request(`/messages?booking_id=${bookingId}`);
    },
    getDirectMessages(userId: string) {
      return client.request(`/messages?direct_user_id=${userId}`);
    },
    getDirectThreads() {
      return client.request('/messages?direct_threads=1');
    },
    sendMessage(messageData: unknown) {
      return client.request('/messages', { method: 'POST', body: JSON.stringify(messageData) });
    },
    markMessageRead(messageId: string) {
      return client.request(`/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ is_read: true }) });
    },
    deleteMessage(messageId: string) {
      return client.request(`/messages/${messageId}`, { method: 'DELETE' });
    },
    clearConversationMessages({ booking_id, direct_user_id }: Record<string, unknown>) {
      const params = client.buildQueryParams({ booking_id, direct_user_id });
      return client.request(`/messages?${params}`, { method: 'DELETE' });
    },
    listDeletedMessages(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams({ deleted: 1, ...filters });
      return client.request(`/messages?${params}`);
    },
    permanentlyDeleteArchivedMessage(id: string) {
      const params = client.buildQueryParams({ deleted_archive_id: id });
      return client.request(`/messages?${params}`, { method: 'DELETE' });
    },
    restoreArchivedMessage(id: string) {
      const params = client.buildQueryParams({ restore_archive_id: id });
      return client.request(`/messages?${params}`, { method: 'PUT', body: JSON.stringify({}) });
    },
    uploadComplianceFile(file: File, documentType = 'qualification') {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);
      return client.request('/uploads', { method: 'POST', body: formData });
    },
    updateCompliance(payload: unknown = {}) {
      return client.request('/profile/compliance', { method: 'PATCH', body: JSON.stringify(payload) });
    },
    getAdminVerifications(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin/verifications?${params}`);
    },
    updateAdminVerification(coachId: string, payload: unknown = {}) {
      return client.request(`/admin/verifications/${coachId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    getAdminAuditLogs(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin/audit-logs?${params}`);
    },
    getAdminDeletedMessages(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin/deleted-messages?${params}`);
    },
    getAdminOpsOverview() {
      return client.request('/admin-ops/overview');
    },
    getAdminUsersOps(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/admin-users?${params}`);
    },
    updateAdminUserScope(adminUserId: string, payload: unknown = {}) {
      return client.request(`/admin-ops/admin-users/${adminUserId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    promoteAdminUser(payload: unknown = {}) {
      return client.request('/admin-ops/admin-users/promote', { method: 'POST', body: JSON.stringify(payload) });
    },
    revokeUserSessions(userId: string) {
      return client.request(`/admin-ops/revoke-session/${userId}`, { method: 'POST' });
    },
    listAdminCases(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/cases?${params}`);
    },
    createAdminCase(payload: unknown = {}) {
      return client.request('/admin-ops/cases', { method: 'POST', body: JSON.stringify(payload) });
    },
    updateAdminCase(caseId: string, payload: unknown = {}) {
      return client.request(`/admin-ops/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    listBookingDisputes(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/disputes?${params}`);
    },
    createBookingDispute(payload: unknown = {}) {
      return client.request('/admin-ops/disputes', { method: 'POST', body: JSON.stringify(payload) });
    },
    updateBookingDispute(disputeId: string, payload: unknown = {}) {
      return client.request(`/admin-ops/disputes/${disputeId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    listComplianceExpiring(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/compliance-expiring?${params}`);
    },
    getWeeklyOpsReport() {
      return client.request('/admin-ops/reports/weekly');
    },
    exportAuditLogs(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/audit-export?${params}`);
    },
    listDeletedUserSnapshots(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/snapshots?${params}`);
    },
    listAuthLogs(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/users/auth-logs?${params}`);
    },
    getAuthLogStats(timeframe = '7 days') {
      const params = client.buildQueryParams({ stats: 1, timeframe });
      return client.request(`/users/auth-logs?${params}`);
    },
    listAdminInvites(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/admin-ops/admin-invites?${params}`);
    },
    createAdminInvite(payload: unknown = {}) {
      return client.request('/admin-ops/admin-invites', { method: 'POST', body: JSON.stringify(payload) });
    },
    revokeAdminInvite(inviteId: string) {
      return client.request(`/admin-ops/admin-invites/${inviteId}`, { method: 'PATCH', body: JSON.stringify({ status: 'revoked' }) });
    },
    verifyAdminInvite(token: string) {
      const params = client.buildQueryParams({ token });
      return client.request(`/admin-ops/admin-invites/verify?${params}`);
    },
    acceptAdminInvite(payload: unknown = {}) {
      return client.request('/admin-ops/admin-invites/accept', { method: 'POST', body: JSON.stringify(payload) });
    },
    changePassword(payload: unknown = {}) {
      return client.request('/users/change-password', { method: 'POST', body: JSON.stringify(payload) });
    },
    forgotPassword(payload: unknown = {}) {
      return client.request('/users/forgot-password', { method: 'POST', body: JSON.stringify(payload) });
    },
    resetPassword(payload: unknown = {}) {
      return client.request('/users/reset-password', { method: 'POST', body: JSON.stringify(payload) });
    },
    getFaqEntries(options: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(options);
      const qs = params.toString() ? `?${params}` : '';
      return client.request(`/help-content${qs}`);
    },
    createFaqEntry(data: unknown) {
      return client.request('/help-content', { method: 'POST', body: JSON.stringify(data) });
    },
    updateFaqEntry(id: string, data: unknown) {
      return client.request(`/help-content?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteFaqEntry(id: string) {
      return client.request(`/help-content?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async recordHelpEvent(data: unknown) {
      try {
        await client.request('/help-analytics', { method: 'POST', body: JSON.stringify(data) });
      } catch {
        // Intentionally silent
      }
    },
    getHelpInsights(days = 30) {
      return client.request(`/help-analytics?days=${encodeURIComponent(days)}`);
    },
    getReviews(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/reviews?${params}`);
    },
    createReview(payload: unknown = {}) {
      return client.request('/reviews', { method: 'POST', body: JSON.stringify(payload) });
    },
    getCoachAvailability(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/availability?${params}`);
    },
    createCoachAvailability(payload: unknown = {}) {
      return client.request('/availability', { method: 'POST', body: JSON.stringify(payload) });
    },
    updateCoachAvailability(id: string, payload: unknown = {}) {
      return client.request(`/availability/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    deleteCoachAvailability(id: string) {
      return client.request(`/availability/${id}`, { method: 'DELETE' });
    },
    getCoachRecurringAvailability(filters: Record<string, unknown> = {}) {
      const params = client.buildQueryParams(filters);
      return client.request(`/availability/recurring?${params}`);
    },
    createCoachRecurringAvailability(payload: unknown = {}) {
      return client.request('/availability/recurring', { method: 'POST', body: JSON.stringify(payload) });
    },
    updateCoachRecurringAvailability(id: string, payload: unknown = {}) {
      return client.request(`/availability/recurring/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    deleteCoachRecurringAvailability(id: string) {
      return client.request(`/availability/recurring/${id}`, { method: 'DELETE' });
    },
  });

  return client as APIClient & Record<string, (...args: any[]) => any>;
};
