import React, { useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { normalizeUserType } from '@fact/domain';
import { getCurrentProfile, GOOGLE_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID, mobileApi, mobileAuth, signInWithEmail, signInWithGoogle, signOut, uploadComplianceAsset } from './src/lib/mobileAuth';

const factIcon = require('./assets/icon.png');

function BrandLogo({ compact = false }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const logoStyle = compact ? styles.logoCompact : styles.logo;

  if (loadFailed) {
    return (
      <View style={[logoStyle, styles.logoFallback]}>
        <Text style={styles.logoFallbackText}>F</Text>
      </View>
    );
  }

  return <Image source={factIcon} style={logoStyle} onError={() => setLoadFailed(true)} />;
}

const primaryActions = [
  {
    label: 'Find a Coach',
    variant: 'primary',
  },
  {
    label: 'Become a Coach',
    variant: 'ghost',
  },
];

const featureCards = [
  {
    title: 'Defensive Mastery',
    body: 'Master tackling, positioning, and tactical awareness with coaches who know the game inside out.',
  },
  {
    title: 'Midfield Engine',
    body: 'Improve passing, vision, and control of the game with specialist midfield coaching.',
  },
  {
    title: "Striker's Instinct",
    body: 'Sharpen your finishing, movement, and goal-scoring with dedicated attacking coaches.',
  },
  {
    title: 'Verified Coaches',
    body: 'Learn from experienced and vetted football experts — every coach on FACT is reviewed.',
  },
];

const coachingTypes = [
  { value: 'striker', label: 'Striker & Finishing' },
  { value: 'midfield', label: 'Midfield & Playmaking' },
  { value: 'defense', label: 'Defense & Tackling' },
  { value: 'goalkeeping', label: 'Goalkeeping' },
  { value: 'fitness_conditioning', label: 'Fitness & Conditioning' },
  { value: 'tactical_analysis', label: 'Tactical Analysis' },
];

const ageGroups = [
  { value: 'under_8', label: 'Under 8s' },
  { value: 'under_10', label: 'Under 10s' },
  { value: 'under_12', label: 'Under 12s' },
  { value: 'under_14', label: 'Under 14s' },
  { value: 'under_16', label: 'Under 16s' },
  { value: 'under_18', label: 'Under 18s' },
  { value: 'adults', label: 'Adults (18+)' },
  { value: 'seniors', label: 'Seniors (35+)' },
];

const adminCaseStatuses = ['open', 'in_progress', 'blocked', 'resolved'];
const adminCasePriorities = ['low', 'normal', 'high', 'critical'];
const adminDisputeStatuses = ['open', 'under_review', 'resolved', 'closed'];
const adminDisputeDecisions = ['refund_full', 'refund_partial', 'no_refund', 'other'];
const adminCaseFilterOptions = ['all', 'open', 'in_progress', 'blocked', 'resolved'];
const adminDisputeFilterOptions = ['all', 'open', 'under_review', 'resolved', 'closed'];
const adminVerificationFilterOptions = ['pending', 'verified', 'rejected', 'incomplete'];
const adminAuditActionOptions = ['all', 'user_deactivated', 'user_hard_delete', 'account_deletion_approved', 'account_deletion_rejected', 'message_deleted', 'message_conversation_cleared'];

const helpCategoryLabels = { all: 'All', onboarding: 'Getting Started', verification: 'Verification', bookings: 'Bookings', messaging: 'Messaging', payments: 'Payments', support: 'Support', security: 'Security' };

function normalizeFaqRow(row) {
  const isDbRow = row.slug !== undefined;
  return {
    id: isDbRow ? (row.slug || row.id) : row.id,
    uuid: isDbRow ? row.id : null,
    role: row.role,
    category: row.category,
    q: row.question || row.q || '',
    a: row.answer || row.a || '',
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    position: row.position || 0,
    is_active: row.is_active !== false,
  };
}

async function openHref(href) {
  const supported = await Linking.canOpenURL(href);
  if (!supported) {
    return;
  }

  await Linking.openURL(href);
}

function formatServiceType(value) {
  return String(value || 'session')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSessionDate(value) {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getBookingDateValue(booking) {
  return booking?.session_date || booking?.booking_date || null;
}

function formatBookingLocation(booking) {
  const type = String(booking?.location?.type || booking?.location_type || 'online')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const address = booking?.location?.address || booking?.location_address;
  return address ? `${type} • ${address}` : type;
}

function formatPrice(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `GBP ${amount}` : 'GBP 0';
}

function formatRelativeMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function formatMessageTime(value) {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMessageDisplayName(message, booking, currentUser) {
  if (message?.sender_id === currentUser?.id) {
    return 'You';
  }

  if (message?.sender_id === booking?.coach_id) {
    return booking?.coach_name || 'Coach';
  }

  if (message?.sender_id === booking?.client_id) {
    return booking?.client_name || 'Client';
  }

  return message?.sender_name || 'FACT';
}

function getBookingMessageRecipient(booking, currentUser, recipientForAdmin) {
  if (!booking || !currentUser?.id) {
    return { id: null, label: 'Conversation' };
  }

  const accountType = normalizeUserType(currentUser?.user_type || 'client');
  if (accountType === 'admin') {
    if (recipientForAdmin === 'coach') {
      return { id: booking.coach_id, label: booking.coach_name || 'Coach' };
    }

    return { id: booking.client_id, label: booking.client_name || 'Client' };
  }

  if (currentUser.id === booking.coach_id) {
    return { id: booking.client_id, label: booking.client_name || 'Client' };
  }

  return { id: booking.coach_id, label: booking.coach_name || 'Coach' };
}

function getConversationLabel(booking, currentUser) {
  const accountType = normalizeUserType(currentUser?.user_type || 'client');
  if (accountType === 'admin') {
    return `${booking?.client_name || 'Client'} ↔ ${booking?.coach_name || 'Coach'}`;
  }

  if (currentUser?.id === booking?.coach_id) {
    return booking?.client_name || 'Client';
  }

  return booking?.coach_name || 'Coach';
}

function formatFullDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatusLabel(value) {
  return String(value || 'incomplete')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAvailabilityWindow(record) {
  if (!record?.start_date || !record?.end_date) {
    return 'Schedule not set';
  }

  const start = new Date(record.start_date);
  const end = new Date(record.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Schedule not set';
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} • ${start.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${end.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return `${formatFullDateTime(record.start_date)} → ${formatFullDateTime(record.end_date)}`;
}

function buildCoachComplianceForm(source) {
  return {
    qualification_type: source?.qualification_type || '',
    qualification_file_url: source?.qualification_file_url || '',
    has_background_check: Boolean(source?.has_background_check),
    background_check_type: source?.background_check_type || '',
    background_check_file_url: source?.background_check_file_url || '',
    background_check_expires_at: formatDateInputValue(source?.background_check_expires_at),
  };
}

function buildAvailabilityForm(record = null) {
  return {
    id: record?.id || null,
    startDate: formatDateInputValue(record?.start_date),
    startTime: formatTimeInputValue(record?.start_date) || '09:00',
    endDate: formatDateInputValue(record?.end_date),
    endTime: formatTimeInputValue(record?.end_date) || '10:00',
    isAvailable: record?.is_available !== false,
    locationOverride: record?.location_override || '',
    notes: record?.notes || '',
  };
}

function buildRecurringAvailabilityForm(record = null) {
  return {
    id: record?.id || null,
    dayOfWeek: record?.day_of_week !== undefined && record?.day_of_week !== null ? String(record.day_of_week) : '1',
    startTime: record?.start_time || '09:00',
    endTime: record?.end_time || '10:00',
    isActive: record?.is_active !== false,
  };
}

function buildAdminCaseDraft(record = null) {
  return {
    status: record?.status || 'open',
    priority: record?.priority || 'normal',
    description: record?.description || '',
  };
}

function buildAdminDisputeDraft(record = null) {
  return {
    status: record?.status || 'open',
    decision: record?.decision || 'other',
    resolution_notes: record?.resolution_notes || '',
    refund_amount: record?.refund_amount === null || record?.refund_amount === undefined ? '' : String(record.refund_amount),
  };
}

function formatRecurringAvailabilityWindow(record) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = Number(record?.day_of_week);
  const dayLabel = Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex <= 6 ? days[dayIndex] : 'Unknown day';
  const start = String(record?.start_time || '--:--').slice(0, 5);
  const end = String(record?.end_time || '--:--').slice(0, 5);
  return `${dayLabel} • ${start} - ${end}`;
}

function buildCoachProfileForm(source) {
  return {
    full_name: source?.full_name || '',
    phone: source?.phone || '',
    country: source?.country || '',
    city: source?.city || '',
    location: source?.location?.address || source?.location || '',
    bio: source?.bio || '',
    hourly_rate: String(source?.coach_profile?.hourly_rate ?? 50),
    video_clip_1: source?.video_clip_1 || '',
    video_clip_2: source?.video_clip_2 || '',
    video_clip_3: source?.video_clip_3 || '',
    services_offered: Array.isArray(source?.coach_profile?.services_offered) ? source.coach_profile.services_offered : [],
    age_groups: Array.isArray(source?.coach_profile?.age_groups) ? source.coach_profile.age_groups : [],
  };
}

function isAllowedVideoHost(hostname) {
  const safeHost = String(hostname || '').toLowerCase();
  return [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'vimeo.com',
    'player.vimeo.com',
  ].includes(safeHost);
}

function normalizeVideoUrl(value) {
  const safeValue = String(value || '').trim();
  if (!safeValue) {
    return { ok: true, value: '' };
  }

  let parsed = null;
  try {
    parsed = new URL(safeValue);
  } catch {
    return { ok: false, error: 'Video links must be valid URLs.' };
  }

  const protocol = String(parsed.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { ok: false, error: 'Video links must start with http:// or https://.' };
  }

  if (!isAllowedVideoHost(parsed.hostname)) {
    return { ok: false, error: 'Only YouTube and Vimeo links are supported for coach clips.' };
  }

  return { ok: true, value: safeValue };
}

function formatDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildIsoDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const composed = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(composed.getTime())) return null;
  return composed.toISOString();
}

function getDirectConversationName(thread, currentUser) {
  if (thread?.other_user_name) {
    return thread.other_user_name;
  }

  const otherType = normalizeUserType(thread?.other_user_type || 'client');
  if (otherType === 'admin') {
    return 'Support Team';
  }

  if (thread?.other_user_id === currentUser?.id) {
    return 'You';
  }

  return 'Conversation';
}

function getDirectMessageDisplayName(message, directThread, currentUser) {
  if (message?.sender_id === currentUser?.id) {
    return 'You';
  }

  return getDirectConversationName(directThread, currentUser);
}

function buildDashboardState(accountType, payload) {
  if (accountType === 'admin') {
    const userStats = payload.userStats || {};
    const bookingStats = payload.bookingStats || {};
    const bookings = Array.isArray(payload.recentBookings) ? payload.recentBookings : [];

    return {
      eyebrow: 'Admin Dashboard',
      heading: 'Overview of users, bookings, and platform activity.',
      subheading: 'Monitor accounts, coaches, clients, and booking flow across the platform.',
      stats: [
        { label: 'Accounts', value: userStats.total_accounts || 0 },
        { label: 'Coaches', value: userStats.total_coaches || 0 },
        { label: 'Clients', value: userStats.total_clients || 0 },
        { label: 'Bookings', value: bookingStats.total || 0 },
      ],
      spotlight: [
        { label: 'Pending', value: bookingStats.pending || 0 },
        { label: 'Confirmed', value: bookingStats.confirmed || 0 },
        { label: 'Completed', value: bookingStats.completed || 0 },
        { label: 'Cancelled', value: bookingStats.cancelled || 0 },
      ],
      bookings,
      bookingsTitle: 'Recent bookings',
      emptyBookingsText: 'No bookings available yet.',
      primaryLink: null,
      secondaryLink: null,
    };
  }

  const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length;
  const confirmedCount = bookings.filter((booking) => booking.status === 'confirmed').length;
  const completedCount = bookings.filter((booking) => booking.status === 'completed').length;

  if (accountType === 'coach') {
    return {
      eyebrow: 'Coach dashboard',
      heading: 'Your schedule and requests',
      subheading: 'Manage booking requests and upcoming sessions without leaving the app.',
      stats: [
        { label: 'Pending', value: pendingCount },
        { label: 'Upcoming', value: confirmedCount },
        { label: 'History', value: completedCount },
        { label: 'Total Sessions', value: bookings.length },
      ],
      spotlight: [
        { label: 'Latest status', value: bookings[0]?.status || 'none' },
      ],
      bookings,
      bookingsTitle: 'Your sessions',
      emptyBookingsText: 'No coach sessions found yet.',
      primaryLink: null,
      secondaryLink: null,
    };
  }

  return {
    eyebrow: 'Client dashboard',
    heading: 'Your upcoming coaching activity',
    subheading: 'See upcoming sessions and move into the full product only when you need deeper tools.',
    stats: [
      { label: 'Upcoming', value: confirmedCount },
      { label: 'Pending', value: pendingCount },
      { label: 'Completed', value: completedCount },
    ],
    spotlight: [
      { label: 'Total bookings', value: bookings.length },
      { label: 'Next session', value: bookings[0]?.session_time || 'TBD' },
    ],
    bookings,
    bookingsTitle: 'Your bookings',
    emptyBookingsText: 'No client bookings found yet.',
    primaryLink: null,
    secondaryLink: null,
  };
}

const BOOKING_STATUS_COLOURS = {
  pending: { backgroundColor: '#fef3c7', color: '#92400e' },
  confirmed: { backgroundColor: '#dcfce7', color: '#166534' },
  completed: { backgroundColor: '#dbeafe', color: '#1e40af' },
  cancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
};

function resolveBookingPartnerLine(booking, accountType) {
  if (accountType === 'admin') {
    const client = booking.client_name || 'Client';
    const coach = booking.coach_name || 'Coach';
    return `${client} → ${coach}`;
  }
  if (accountType === 'coach' && booking.client_name) return booking.client_name;
  if (accountType === 'client' && booking.coach_name) return booking.coach_name;
  return null;
}

function BookingCard({ booking, accountType }) {
  const status = booking.status || 'pending';
  const statusColours = BOOKING_STATUS_COLOURS[status] || { backgroundColor: '#f3f4f6', color: '#374151' };
  const partnerLine = resolveBookingPartnerLine(booking, accountType);
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{formatServiceType(booking.service_type)}</Text>
        <View style={[styles.bookingStatusBadge, { backgroundColor: statusColours.backgroundColor }]}>
          <Text style={[styles.bookingStatus, { color: statusColours.color }]}>{status}</Text>
        </View>
      </View>
      {partnerLine ? <Text style={styles.bookingPartner}>{partnerLine}</Text> : null}
      <Text style={styles.bookingMeta}>{formatSessionDate(getBookingDateValue(booking))}</Text>
      <Text style={styles.bookingMeta}>{booking.session_time || 'Time TBD'} • {formatPrice(booking.total_price || booking.price)}</Text>
    </View>
  );
}

function BookingListScreen({ accountType, bookings, loading, errorMessage, onBack, onRefresh, onSelectBooking, titleOverride, subtitleOverride }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBookings, setFilteredBookings] = useState(bookings);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBookings(bookings);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = bookings.filter(
      (booking) =>
        booking.reference_code?.toLowerCase().includes(term) ||
        booking.service_type?.toLowerCase().includes(term) ||
        booking.status?.toLowerCase().includes(term)
    );
    setFilteredBookings(filtered);
  }, [searchTerm, bookings]);

  const defaultTitle = accountType === 'admin' ? 'Booking Queue' : accountType === 'coach' ? 'Coach Sessions' : 'My Bookings';
  const defaultSubtitle = accountType === 'admin'
    ? 'Review recent booking activity from the native app.'
    : accountType === 'coach'
      ? 'See requests, confirmed sessions, and history in one place.'
      : 'Review your upcoming and past bookings without leaving the app.';
  const title = titleOverride || defaultTitle;
  const subtitle = subtitleOverride || defaultSubtitle;

  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent}>
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>{title}</Text>
        <Text style={styles.signInTitleDark}>{title}</Text>
        <Text style={styles.signInSubtitleDark}>{subtitle}</Text>

        {accountType === 'admin' ? (
          <View style={styles.searchContainer}>
            <Text style={styles.searchLabel}>Search Booking Reference</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter booking reference"
              placeholderTextColor="#64748b"
              value={searchTerm}
              onChangeText={setSearchTerm}
              textContentType="none"
              autoCapitalize="characters"
            />
          </View>
        ) : null}

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading bookings...</Text>
          </View>
        ) : filteredBookings.length > 0 ? (
          <View style={styles.bookingListLarge}>
            {filteredBookings.map((booking) => {
              const bStatus = booking.status || 'pending';
              const bColours = BOOKING_STATUS_COLOURS[bStatus] || { backgroundColor: '#f3f4f6', color: '#374151' };
              const bPartner = resolveBookingPartnerLine(booking, accountType);
              return (
                <Pressable key={booking.id} onPress={() => onSelectBooking(booking)} style={({ pressed }) => [styles.bookingCard, pressed && styles.actionButtonPressed]}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingTitle}>{formatServiceType(booking.service_type)}</Text>
                    <View style={[styles.bookingStatusBadge, { backgroundColor: bColours.backgroundColor }]}>
                      <Text style={[styles.bookingStatus, { color: bColours.color }]}>{bStatus}</Text>
                    </View>
                  </View>
                  {bPartner ? <Text style={styles.bookingPartner}>{bPartner}</Text> : null}
                  {booking.reference_code ? (
                    <Text style={styles.bookingMeta}>Ref: {booking.reference_code}</Text>
                  ) : null}
                  <Text style={styles.bookingMeta}>{formatSessionDate(getBookingDateValue(booking))}</Text>
                  <Text style={styles.bookingMeta}>{booking.session_time || 'Time TBD'} • {formatPrice(booking.total_price || booking.price)}</Text>
                  <Text style={styles.bookingMeta}>{formatBookingLocation(booking)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardCopy}>{searchTerm.trim() ? 'No bookings match your search.' : 'No bookings available yet.'}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function BookingDetailScreen({ booking, currentUser, actionLoading, actionError, onBack, onOpenMessages, onOpenReschedule, onConfirmBooking, onCancelBooking, onCompleteBooking }) {
  const accountType = normalizeUserType(currentUser?.user_type || 'client');
  const canConfirmBooking = booking.status === 'pending' && (accountType === 'coach' || accountType === 'admin');
  const canCancelBooking = !['cancelled', 'completed'].includes(booking.status);
  const canCompleteBooking = booking.status === 'confirmed' || booking.status === 'in_session';
  const hasPendingReschedule = booking.reschedule_status === 'pending' && booking.reschedule_proposed_date;
  const isRequester = booking.reschedule_requested_by === currentUser?.id;
  const canOpenReschedule = !['cancelled', 'completed'].includes(booking.status) || hasPendingReschedule;

  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent}>
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Booking Detail</Text>
        <Text style={styles.signInTitleDark}>{formatServiceType(booking.service_type)}</Text>
        <Text style={styles.signInSubtitleDark}>Reference {booking.reference_code || 'Pending'}</Text>

        <View style={styles.featureGrid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status</Text>
            <Text style={styles.cardCopy}>{booking.status || 'pending'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Date</Text>
            <Text style={styles.cardCopy}>{formatSessionDate(getBookingDateValue(booking))}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Time</Text>
            <Text style={styles.cardCopy}>{booking.session_time || 'Time TBD'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Price</Text>
            <Text style={styles.cardCopy}>{formatPrice(booking.total_price || booking.price)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <Text style={styles.cardCopy}>{formatBookingLocation(booking)}</Text>
        </View>

        {booking.client_notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Client notes</Text>
            <Text style={styles.cardCopy}>{booking.client_notes}</Text>
          </View>
        ) : null}

        {hasPendingReschedule ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isRequester ? 'Reschedule requested' : 'Reschedule review needed'}</Text>
            <Text style={styles.cardCopy}>{formatFullDateTime(booking.reschedule_proposed_date)}</Text>
          </View>
        ) : null}

        {actionError ? <Text style={styles.errorTextLight}>{actionError}</Text> : null}

        <View style={styles.actionGroupSignedIn}>
          {canOpenReschedule ? (
            <Pressable
              disabled={actionLoading}
              onPress={onOpenReschedule}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, (pressed || actionLoading) && styles.actionButtonPressed]}
            >
              <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>{hasPendingReschedule && !isRequester ? 'Review reschedule' : 'Reschedule booking'}</Text>
              <Text style={[styles.actionBody, styles.actionBodySecondary]}>
                {hasPendingReschedule && !isRequester ? 'Accept or decline the proposed new time.' : 'Propose a new session time from the mobile app.'}
              </Text>
            </Pressable>
          ) : null}

          {canConfirmBooking ? (
            <Pressable
              disabled={actionLoading}
              onPress={onConfirmBooking}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || actionLoading) && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Confirm booking</Text>
              <Text style={styles.actionBody}>Accept this request and move it into a confirmed session.</Text>
            </Pressable>
          ) : null}

          {canCompleteBooking ? (
            <Pressable
              disabled={actionLoading}
              onPress={onCompleteBooking}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || actionLoading) && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Mark completed</Text>
              <Text style={styles.actionBody}>Update the session status directly from mobile.</Text>
            </Pressable>
          ) : null}

          {canCancelBooking ? (
            <Pressable
              disabled={actionLoading}
              onPress={onCancelBooking}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonGhost, (pressed || actionLoading) && styles.actionButtonPressed]}
            >
              <Text style={[styles.actionTitle, styles.actionTitleGhost]}>Cancel booking</Text>
              <Text style={[styles.actionBody, styles.actionBodyGhost]}>Cancel this booking without leaving the app.</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={onOpenMessages} style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}>
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Open native messages</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Stay inside the app for the booking conversation.</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function BookingRescheduleScreen({
  booking,
  currentUser,
  dateValue,
  timeValue,
  submitting,
  errorMessage,
  onDateChange,
  onTimeChange,
  onBack,
  onRequest,
  onAccept,
  onDecline,
}) {
  const isRequester = booking.reschedule_requested_by === currentUser?.id;
  const hasPendingReschedule = booking.reschedule_status === 'pending';
  const isReviewMode = hasPendingReschedule && !isRequester;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.signInHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.signInCardDark}>
          <Text style={styles.sectionEyebrow}>Reschedule</Text>
          <Text style={styles.signInTitleDark}>{isReviewMode ? 'Review new time' : 'Request a new time'}</Text>
          <Text style={styles.signInSubtitleDark}>
            {isReviewMode
              ? 'Review the proposed new booking time and respond from mobile.'
              : 'Pick a new date and time. The other party can then accept or decline it.'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current booking time</Text>
            <Text style={styles.cardCopy}>{formatFullDateTime(booking.booking_date)}</Text>
          </View>

          {isReviewMode ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Proposed new time</Text>
              <Text style={styles.cardCopy}>{formatFullDateTime(booking.reschedule_proposed_date)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelLight}>New date</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={onDateChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748b"
                  style={styles.inputDark}
                  value={dateValue}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelLight}>New time</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={onTimeChange}
                  placeholder="HH:MM"
                  placeholderTextColor="#64748b"
                  style={styles.inputDark}
                  value={timeValue}
                />
              </View>
            </>
          )}

          {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

          <View style={styles.actionGroupSignedIn}>
            {isReviewMode ? (
              <>
                <Pressable
                  disabled={submitting}
                  onPress={onAccept}
                  style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || submitting) && styles.actionButtonPressed]}
                >
                  <Text style={styles.actionTitle}>Accept new time</Text>
                  <Text style={styles.actionBody}>Move the booking to the proposed date and time.</Text>
                </Pressable>

                <Pressable
                  disabled={submitting}
                  onPress={onDecline}
                  style={({ pressed }) => [styles.actionButton, styles.actionButtonGhost, (pressed || submitting) && styles.actionButtonPressed]}
                >
                  <Text style={[styles.actionTitle, styles.actionTitleGhost]}>Decline request</Text>
                  <Text style={[styles.actionBody, styles.actionBodyGhost]}>Keep the current booking time in place.</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                disabled={submitting}
                onPress={onRequest}
                style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || submitting) && styles.actionButtonPressed]}
              >
                <Text style={styles.actionTitle}>Request reschedule</Text>
                <Text style={styles.actionBody}>Send the proposed new time to the other party.</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BookingMessagesScreen({
  booking,
  currentUser,
  messages,
  loading,
  errorMessage,
  draft,
  sending,
  recipientForAdmin,
  onRecipientChange,
  onDraftChange,
  onBack,
  onRefresh,
  onSend,
}) {
  const scrollRef = useRef(null);
  const accountType = normalizeUserType(currentUser?.user_type || 'client');
  const recipient = getBookingMessageRecipient(booking, currentUser, recipientForAdmin);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.safeArea}>
      <View style={styles.messagesShell}>
        <View style={styles.signInHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.signInCardDark}>
          <Text style={styles.sectionEyebrow}>Booking Messages</Text>
          <Text style={styles.signInTitleDark}>{recipient.label}</Text>
          <Text style={styles.signInSubtitleDark}>
            {formatServiceType(booking.service_type)} • Reference {booking.reference_code || 'Pending'}
          </Text>

          <View style={styles.messageMetaRow}>
            <Text style={styles.messageMetaPill}>{formatSessionDate(getBookingDateValue(booking))}</Text>
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
              <Text style={styles.inlineActionButtonText}>Refresh</Text>
            </Pressable>
          </View>

          {accountType === 'admin' ? (
            <View style={styles.recipientToggleRow}>
              <Pressable
                onPress={() => onRecipientChange('client')}
                style={({ pressed }) => [
                  styles.recipientToggle,
                  recipientForAdmin === 'client' && styles.recipientToggleActive,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text style={[styles.recipientToggleText, recipientForAdmin === 'client' && styles.recipientToggleTextActive]}>
                  Message {booking.client_name || 'client'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRecipientChange('coach')}
                style={({ pressed }) => [
                  styles.recipientToggle,
                  recipientForAdmin === 'coach' && styles.recipientToggleActive,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text style={[styles.recipientToggleText, recipientForAdmin === 'coach' && styles.recipientToggleTextActive]}>
                  Message {booking.coach_name || 'coach'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.dashboardLoadingRow}>
                <ActivityIndicator color="#f59e0b" />
                <Text style={styles.cardCopy}>Loading conversation...</Text>
              </View>
            ) : messages.length > 0 ? (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                return (
                  <View
                    key={message.id || `${message.sender_id}-${message.created_date}-${message.content}`}
                    style={[
                      styles.messageBubble,
                      isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther,
                    ]}
                  >
                    <Text style={[styles.messageSender, isOwnMessage && styles.messageSenderOwn]}>
                      {getMessageDisplayName(message, booking, currentUser)}
                    </Text>
                    <Text style={[styles.messageBody, isOwnMessage && styles.messageBodyOwn]}>{message.content}</Text>
                    <Text style={[styles.messageTimestamp, isOwnMessage && styles.messageTimestampOwn]}>
                      {formatMessageTime(message.created_date || message.updated_at)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No messages yet</Text>
                <Text style={styles.cardCopy}>Start the booking conversation here. Your draft stays on device until a send succeeds.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.messageComposer}>
            <TextInput
              multiline={true}
              onChangeText={onDraftChange}
              placeholder="Write a message"
              placeholderTextColor="#64748b"
              style={styles.messageInput}
              textAlignVertical="top"
              value={draft}
            />
            <Pressable
              disabled={sending || !String(draft || '').trim()}
              onPress={onSend}
              style={({ pressed }) => [
                styles.submitButton,
                styles.messageSendButton,
                (pressed || sending || !String(draft || '').trim()) && styles.actionButtonPressed,
                !String(draft || '').trim() && styles.messageSendButtonDisabled,
              ]}
            >
              {sending ? <ActivityIndicator color="#08111f" /> : <Text style={styles.submitButtonText}>Send</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function DirectMessagesScreen({
  thread,
  currentUser,
  messages,
  loading,
  errorMessage,
  draft,
  sending,
  onDraftChange,
  onBack,
  onRefresh,
  onSend,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.safeArea}>
      <View style={styles.messagesShell}>
        <View style={styles.signInHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.signInCardDark}>
          <Text style={styles.sectionEyebrow}>Direct Messages</Text>
          <Text style={styles.signInTitleDark}>{getDirectConversationName(thread, currentUser)}</Text>
          <Text style={styles.signInSubtitleDark}>Direct support and admin conversations now stay in the app too.</Text>

          <View style={styles.messageMetaRow}>
            <Text style={styles.messageMetaPill}>Direct conversation</Text>
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
              <Text style={styles.inlineActionButtonText}>Refresh</Text>
            </Pressable>
          </View>

          {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.dashboardLoadingRow}>
                <ActivityIndicator color="#f59e0b" />
                <Text style={styles.cardCopy}>Loading conversation...</Text>
              </View>
            ) : messages.length > 0 ? (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                return (
                  <View
                    key={message.id || `${message.sender_id}-${message.created_date}-${message.content}`}
                    style={[
                      styles.messageBubble,
                      isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther,
                    ]}
                  >
                    <Text style={[styles.messageSender, isOwnMessage && styles.messageSenderOwn]}>
                      {getDirectMessageDisplayName(message, thread, currentUser)}
                    </Text>
                    <Text style={[styles.messageBody, isOwnMessage && styles.messageBodyOwn]}>{message.content}</Text>
                    <Text style={[styles.messageTimestamp, isOwnMessage && styles.messageTimestampOwn]}>
                      {formatMessageTime(message.created_date || message.updated_at)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No messages yet</Text>
                <Text style={styles.cardCopy}>Start a direct conversation here. Draft text stays on device until a send succeeds.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.messageComposer}>
            <TextInput
              multiline={true}
              onChangeText={onDraftChange}
              placeholder="Write a message"
              placeholderTextColor="#64748b"
              style={styles.messageInput}
              textAlignVertical="top"
              value={draft}
            />
            <Pressable
              disabled={sending || !String(draft || '').trim()}
              onPress={onSend}
              style={({ pressed }) => [
                styles.submitButton,
                styles.messageSendButton,
                (pressed || sending || !String(draft || '').trim()) && styles.actionButtonPressed,
                !String(draft || '').trim() && styles.messageSendButtonDisabled,
              ]}
            >
              {sending ? <ActivityIndicator color="#08111f" /> : <Text style={styles.submitButtonText}>Send</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessagesInboxScreen({ conversations, loading, errorMessage, onBack, onRefresh, onOpenConversation }) {
  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent}>
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Messages</Text>
        <Text style={styles.signInTitleDark}>Native inbox</Text>
        <Text style={styles.signInSubtitleDark}>Open booking conversations directly in the app and drop to the web only for flows that still have not been migrated.</Text>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh inbox</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading conversations...</Text>
          </View>
        ) : conversations.length > 0 ? (
          <View style={styles.bookingListLarge}>
            {conversations.map((conversation) => (
              <Pressable
                key={conversation.booking_id || conversation.direct_user_id}
                onPress={() => onOpenConversation(conversation)}
                style={({ pressed }) => [styles.conversationCard, pressed && styles.actionButtonPressed]}
              >
                <View style={styles.conversationHeader}>
                  <Text style={[styles.bookingTitle, !conversation.is_read && styles.conversationUnreadTitle]}>{conversation.other_user_name}</Text>
                  <Text style={styles.conversationTime}>{formatRelativeMessageTime(conversation.last_message_date)}</Text>
                </View>
                <Text style={styles.bookingMeta}>
                  {conversation.type === 'direct'
                    ? 'Direct support thread'
                    : `${formatServiceType(conversation.booking.service_type)} • ${formatSessionDate(getBookingDateValue(conversation.booking))}`}
                </Text>
                <Text style={[styles.conversationPreview, !conversation.is_read && styles.conversationPreviewUnread]} numberOfLines={2}>
                  {conversation.last_message}
                </Text>
                {!conversation.is_read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No messages yet</Text>
            <Text style={styles.cardCopy}>Your booking conversations will appear here as they start.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function AdminUsersScreen({ users, total, loading, errorMessage, onBack, onRefresh, screenTitle = 'Users (All)', screenHeading = 'All registered users', screenSubtitle = 'Review every account currently registered in the platform from the native app.' }) {
  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>{screenTitle}</Text>
        <Text style={styles.signInTitleDark}>{screenHeading}</Text>
        <Text style={styles.signInSubtitleDark}>{screenSubtitle}</Text>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh users</Text>
        </Pressable>

        {!loading ? <Text style={styles.metaCaption}>Showing {users.length} of {total}</Text> : null}
        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading users...</Text>
          </View>
        ) : users.length > 0 ? (
          <View style={styles.featureGrid}>
            {users.map((user) => {
              const resolvedType = normalizeUserType(user?.user_type || user?.role || 'client');
              return (
                <View key={user.id || `${user.email}-${user.member_public_id || user.member_id || 'member'}`} style={styles.availabilityCard}>
                  <Text style={styles.compactListTitle}>{user.full_name || user.email || 'User'}</Text>
                  <Text style={styles.compactListMeta}>{user.email || 'No email'}</Text>
                  <Text style={styles.compactListMeta}>Type: {resolvedType}</Text>
                  <Text style={styles.compactListMeta}>Member ID: {user.member_public_id || user.member_id || 'N/A'}</Text>
                  <Text style={styles.compactListMeta}>Status: {user.is_active === false ? 'inactive' : 'active'}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardCopy}>No registered users returned yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function AdminOperationsScreen({
  overview,
  weekly,
  cases,
  disputes,
  expiring,
  verifications,
  caseFilter,
  disputeFilter,
  caseDrafts,
  disputeDrafts,
  verificationFilter,
  caseTotal,
  disputeTotal,
  verificationTotal,
  verificationNotes,
  caseSubmittingId,
  disputeSubmittingId,
  verificationSubmittingId,
  caseError,
  disputeError,
  verificationError,
  caseSuccess,
  disputeSuccess,
  verificationSuccess,
  loading,
  errorMessage,
  inviteEmail,
  inviteScope,
  inviteHours,
  inviteSubmitting,
  inviteError,
  onInviteEmailChange,
  onInviteScopeChange,
  onInviteHoursChange,
  onBack,
  onRefresh,
  onCreateInvite,
  onCaseDraftChange,
  onDisputeDraftChange,
  onSaveCase,
  onAssignCaseToCurrentAdmin,
  onSaveDispute,
  onAssignDisputeToCurrentAdmin,
  onCaseFilterChange,
  onDisputeFilterChange,
  onLoadMoreCases,
  onLoadMoreDisputes,
  onLoadMoreVerifications,
  onVerificationFilterChange,
  onVerificationNoteChange,
  onUpdateVerification,
  adminUsers,
  adminInvites,
  snapshots,
  snapshotsTotal,
  signupAttempts,
  signupTotal,
  revokeSessionLoadingId,
  revokeInviteLoadingId,
  onRevokeSession,
  onRevokeInvite,
  onLoadMoreSignupAttempts,
}) {
  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Admin Operations</Text>
        <Text style={styles.signInTitleDark}>Native ops command surface</Text>
        <Text style={styles.signInSubtitleDark}>Monitor platform health, outstanding admin work, and send invites without dropping back to the web dashboard.</Text>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh operations</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading admin operations...</Text>
          </View>
        ) : (
          <>
            <View style={styles.adminStatGrid}>
              <View style={styles.adminStatRow}>
                <View style={[styles.statTile, styles.adminStatTile]}>
                  <Text style={styles.statLabel}>Accounts</Text>
                  <Text style={styles.statValue}>{overview?.users?.total_accounts || 0}</Text>
                </View>
                <View style={[styles.statTile, styles.adminStatTile]}>
                  <Text style={styles.statLabel}>Open Cases</Text>
                  <Text style={styles.statValue}>{overview?.operations?.open_cases || 0}</Text>
                </View>
              </View>
              <View style={styles.adminStatRow}>
                <View style={[styles.statTile, styles.adminStatTile]}>
                  <Text style={styles.statLabel}>Open Disputes</Text>
                  <Text style={styles.statValue}>{overview?.operations?.open_disputes || 0}</Text>
                </View>
                <View style={[styles.statTile, styles.adminStatTile]}>
                  <Text style={styles.statLabel}>Deletion Requests</Text>
                  <Text style={styles.statValue}>{overview?.operations?.pending_deletion_requests || 0}</Text>
                </View>
              </View>
            </View>

            <View style={styles.featureGrid}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Weekly activity</Text>
                <Text style={styles.cardCopy}>New profiles: {weekly?.current_week?.new_profiles || 0}</Text>
                <Text style={styles.cardCopy}>New bookings: {weekly?.current_week?.new_bookings || 0}</Text>
                <Text style={styles.cardCopy}>Completed bookings: {weekly?.current_week?.completed_bookings || 0}</Text>
                <Text style={styles.cardCopy}>Admin actions: {weekly?.current_week?.admin_actions || 0}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Reliability</Text>
                <Text style={styles.cardCopy}>Auth events 24h: {overview?.reliability?.auth_events_24h || 0}</Text>
                <Text style={styles.cardCopy}>Email failures 24h: {overview?.reliability?.email_failures_24h || 0}</Text>
                <Text style={styles.cardCopy}>Expiring background checks: {overview?.operations?.expiring_background_checks_30d || 0}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create admin invite</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Email</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={onInviteEmailChange}
                    placeholder="admin@example.com"
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={inviteEmail}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Scope</Text>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={onInviteScopeChange}
                    placeholder="support"
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={inviteScope}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Expires in hours</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={onInviteHoursChange}
                    placeholder="72"
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={inviteHours}
                  />
                </View>

                {inviteError ? <Text style={styles.errorTextLight}>{inviteError}</Text> : null}

                <Pressable
                  disabled={inviteSubmitting}
                  onPress={onCreateInvite}
                  style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || inviteSubmitting) && styles.actionButtonPressed]}
                >
                  <Text style={styles.actionTitle}>Send admin invite</Text>
                  <Text style={styles.actionBody}>Issue an invitation using the live admin ops endpoint.</Text>
                </Pressable>

                {adminInvites.length > 0 ? (
                  <>
                    <Text style={[styles.cardTitle, { marginTop: 16 }]}>Existing invites</Text>
                    {adminInvites.map((invite) => (
                      <View key={invite.id} style={styles.availabilityCard}>
                        <Text style={styles.compactListTitle}>{invite.email}</Text>
                        <Text style={styles.compactListMeta}>{invite.admin_scope} • {formatStatusLabel(invite.status)}</Text>
                        {invite.expires_at ? <Text style={styles.compactListMeta}>Expires: {formatFullDateTime(invite.expires_at)}</Text> : null}
                        {invite.status === 'pending' ? (
                          <Pressable
                            disabled={revokeInviteLoadingId === invite.id}
                            onPress={() => onRevokeInvite(invite.id)}
                            style={({ pressed }) => [styles.inlineDangerButton, (pressed || revokeInviteLoadingId === invite.id) && styles.actionButtonPressed, { marginTop: 8 }]}
                          >
                            <Text style={styles.inlineDangerButtonText}>{revokeInviteLoadingId === invite.id ? 'Revoking…' : 'Revoke'}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Admin team</Text>
                <Text style={styles.metaCaption}>{adminUsers.length} admin records</Text>
                {adminUsers.length > 0 ? adminUsers.map((admin) => (
                  <View key={admin.id} style={styles.availabilityCard}>
                    <Text style={styles.compactListTitle}>{admin.full_name || admin.email || 'Admin'}</Text>
                    <Text style={styles.compactListMeta}>Scope: {admin.admin_scope || 'full'} • {admin.is_active === false ? 'Inactive' : 'Active'}</Text>
                    <Pressable
                      disabled={revokeSessionLoadingId === admin.id}
                      onPress={() => onRevokeSession(admin.id)}
                      style={({ pressed }) => [styles.inlineDangerButton, (pressed || revokeSessionLoadingId === admin.id) && styles.actionButtonPressed, { marginTop: 8 }]}
                    >
                      <Text style={styles.inlineDangerButtonText}>{revokeSessionLoadingId === admin.id ? 'Revoking…' : 'Revoke session'}</Text>
                    </Pressable>
                  </View>
                )) : <Text style={styles.cardCopy}>No admin users found.</Text>}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent cases</Text>
                <View style={styles.filterToggleRow}>
                  {adminCaseFilterOptions.map((status) => (
                    <Pressable
                      key={`case-filter-${status}`}
                      onPress={() => onCaseFilterChange(status)}
                      style={[styles.filterToggle, caseFilter === status && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, caseFilter === status && styles.recipientToggleTextActive]}>{formatStatusLabel(status)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.metaCaption}>Showing {cases.length} of {caseTotal}</Text>
                {caseError ? <Text style={styles.errorTextLight}>{caseError}</Text> : null}
                {caseSuccess ? <Text style={styles.successTextLight}>{caseSuccess}</Text> : null}
                {cases.length > 0 ? cases.slice(0, 4).map((item) => {
                  const draft = caseDrafts[item.id] || buildAdminCaseDraft(item);
                  const submitting = caseSubmittingId === item.id;
                  return (
                    <View key={item.id} style={styles.availabilityCard}>
                      <Text style={styles.compactListTitle}>{item.title}</Text>
                      <Text style={styles.compactListMeta}>{formatStatusLabel(item.status)} • {formatStatusLabel(item.priority)}</Text>
                      <Text style={styles.compactListMeta}>Category: {formatStatusLabel(item.category)}</Text>
                      <Text style={styles.compactListMeta}>Owner: {item.owner_name || 'Unassigned'}</Text>
                      {item.target_name ? <Text style={styles.compactListMeta}>Target: {item.target_name}</Text> : null}

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Case notes</Text>
                        <TextInput
                          multiline={true}
                          onChangeText={(value) => onCaseDraftChange(item.id, 'description', value)}
                          placeholder="Add notes or resolution context"
                          placeholderTextColor="#64748b"
                          style={[styles.inputDark, styles.notesInput]}
                          value={draft.description}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Status</Text>
                        <View style={styles.recipientToggleRow}>
                          {adminCaseStatuses.map((status) => (
                            <Pressable
                              key={`${item.id}-${status}`}
                              onPress={() => onCaseDraftChange(item.id, 'status', status)}
                              style={[styles.recipientToggle, draft.status === status && styles.recipientToggleActive]}
                            >
                              <Text style={[styles.recipientToggleText, draft.status === status && styles.recipientToggleTextActive]}>{formatStatusLabel(status)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Priority</Text>
                        <View style={styles.recipientToggleRow}>
                          {adminCasePriorities.map((priority) => (
                            <Pressable
                              key={`${item.id}-${priority}`}
                              onPress={() => onCaseDraftChange(item.id, 'priority', priority)}
                              style={[styles.recipientToggle, draft.priority === priority && styles.recipientToggleActive]}
                            >
                              <Text style={[styles.recipientToggleText, draft.priority === priority && styles.recipientToggleTextActive]}>{formatStatusLabel(priority)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={styles.inlineButtonRow}>
                        <Pressable
                          disabled={submitting}
                          onPress={() => onAssignCaseToCurrentAdmin(item)}
                          style={({ pressed }) => [styles.inlineSecondaryButton, (pressed || submitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlineSecondaryButtonText}>Assign to me</Text>
                        </Pressable>
                        <Pressable
                          disabled={submitting}
                          onPress={() => onSaveCase(item)}
                          style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || submitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlinePrimaryButtonText}>{submitting ? 'Saving...' : 'Save case'}</Text>
                        </Pressable>
                        <Pressable
                          disabled={submitting}
                          onPress={() => onSaveCase(item, { status: 'resolved' })}
                          style={({ pressed }) => [styles.inlineDangerButton, (pressed || submitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlineDangerButtonText}>Resolve</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }) : <Text style={styles.cardCopy}>No cases available.</Text>}
                {cases.length < caseTotal ? (
                  <Pressable onPress={onLoadMoreCases} style={({ pressed }) => [styles.inlineActionButton, styles.loadMoreButton, pressed && styles.actionButtonPressed]}>
                    <Text style={styles.inlineActionButtonText}>Load more cases</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent disputes</Text>
                <View style={styles.filterToggleRow}>
                  {adminDisputeFilterOptions.map((status) => (
                    <Pressable
                      key={`dispute-filter-${status}`}
                      onPress={() => onDisputeFilterChange(status)}
                      style={[styles.filterToggle, disputeFilter === status && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, disputeFilter === status && styles.recipientToggleTextActive]}>{formatStatusLabel(status)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.metaCaption}>Showing {disputes.length} of {disputeTotal}</Text>
                {disputeError ? <Text style={styles.errorTextLight}>{disputeError}</Text> : null}
                {disputeSuccess ? <Text style={styles.successTextLight}>{disputeSuccess}</Text> : null}
                {disputes.length > 0 ? disputes.slice(0, 4).map((item) => {
                  const draft = disputeDrafts[item.id] || buildAdminDisputeDraft(item);
                  const submitting = disputeSubmittingId === item.id;
                  return (
                    <View key={item.id} style={styles.availabilityCard}>
                      <Text style={styles.compactListTitle}>{item.reason || 'Booking dispute'}</Text>
                      <Text style={styles.compactListMeta}>{formatStatusLabel(item.status)} {item.booking_id ? `• ${item.booking_id.slice(0, 8)}` : ''}</Text>
                      <Text style={styles.compactListMeta}>Assigned: {item.assigned_admin_name || 'Unassigned'}</Text>
                      {item.decision ? <Text style={styles.compactListMeta}>Decision: {formatStatusLabel(item.decision)}</Text> : null}

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Dispute status</Text>
                        <View style={styles.recipientToggleRow}>
                          {adminDisputeStatuses.map((status) => (
                            <Pressable
                              key={`${item.id}-${status}`}
                              onPress={() => onDisputeDraftChange(item.id, 'status', status)}
                              style={[styles.recipientToggle, draft.status === status && styles.recipientToggleActive]}
                            >
                              <Text style={[styles.recipientToggleText, draft.status === status && styles.recipientToggleTextActive]}>{formatStatusLabel(status)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Decision</Text>
                        <View style={styles.recipientToggleRow}>
                          {adminDisputeDecisions.map((decision) => (
                            <Pressable
                              key={`${item.id}-${decision}`}
                              onPress={() => onDisputeDraftChange(item.id, 'decision', decision)}
                              style={[styles.recipientToggle, draft.decision === decision && styles.recipientToggleActive]}
                            >
                              <Text style={[styles.recipientToggleText, draft.decision === decision && styles.recipientToggleTextActive]}>{formatStatusLabel(decision)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Refund amount</Text>
                        <TextInput
                          keyboardType="decimal-pad"
                          onChangeText={(value) => onDisputeDraftChange(item.id, 'refund_amount', value)}
                          placeholder="0"
                          placeholderTextColor="#64748b"
                          style={styles.inputDark}
                          value={draft.refund_amount}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Resolution notes</Text>
                        <TextInput
                          multiline={true}
                          onChangeText={(value) => onDisputeDraftChange(item.id, 'resolution_notes', value)}
                          placeholder="Document refund logic, contact attempts, or outcome"
                          placeholderTextColor="#64748b"
                          style={[styles.inputDark, styles.notesInput]}
                          value={draft.resolution_notes}
                        />
                      </View>

                      <View style={styles.inlineButtonRow}>
                        <Pressable
                          disabled={submitting}
                          onPress={() => onAssignDisputeToCurrentAdmin(item)}
                          style={({ pressed }) => [styles.inlineSecondaryButton, (pressed || submitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlineSecondaryButtonText}>Assign to me</Text>
                        </Pressable>
                        <Pressable
                          disabled={submitting}
                          onPress={() => onSaveDispute(item)}
                          style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || submitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlinePrimaryButtonText}>{submitting ? 'Saving...' : 'Save dispute'}</Text>
                        </Pressable>
                        <Pressable
                          disabled={submitting}
                          onPress={() => onSaveDispute(item, { status: 'resolved' })}
                          style={({ pressed }) => [styles.inlineDangerButton, (pressed || submitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlineDangerButtonText}>Resolve</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }) : <Text style={styles.cardCopy}>No disputes available.</Text>}
                {disputes.length < disputeTotal ? (
                  <Pressable onPress={onLoadMoreDisputes} style={({ pressed }) => [styles.inlineActionButton, styles.loadMoreButton, pressed && styles.actionButtonPressed]}>
                    <Text style={styles.inlineActionButtonText}>Load more disputes</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Compliance expiring</Text>
                {expiring.length > 0 ? expiring.slice(0, 4).map((item) => (
                  <View key={item.id} style={styles.compactListRow}>
                    <Text style={styles.compactListTitle}>{item.full_name || item.email || 'Coach'}</Text>
                    <Text style={styles.compactListMeta}>{formatFullDateTime(item.background_check_expires_at)}</Text>
                  </View>
                )) : <Text style={styles.cardCopy}>No expiring compliance records.</Text>}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Coach verifications</Text>

                <View style={styles.filterToggleRow}>
                  {adminVerificationFilterOptions.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => onVerificationFilterChange(status)}
                      style={[styles.filterToggle, verificationFilter === status && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, verificationFilter === status && styles.recipientToggleTextActive]}>{formatStatusLabel(status)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.metaCaption}>Showing {verifications.length} of {verificationTotal}</Text>

                {verificationError ? <Text style={styles.errorTextLight}>{verificationError}</Text> : null}
                {verificationSuccess ? <Text style={styles.successTextLight}>{verificationSuccess}</Text> : null}

                {verifications.length > 0 ? verifications.map((coach) => {
                  const noteDraft = verificationNotes[coach.id] ?? (coach.verification_notes || '');
                  return (
                    <View key={coach.id} style={styles.availabilityCard}>
                      <Text style={styles.compactListTitle}>{coach.full_name || coach.email || 'Coach'}</Text>
                      <Text style={styles.compactListMeta}>Qualification: {formatStatusLabel(coach.qualification_status)}</Text>
                      <Text style={styles.compactListMeta}>Background: {coach.has_background_check ? formatStatusLabel(coach.background_check_status) : 'Not required'}</Text>

                      <View style={styles.inlineButtonRow}>
                        {coach.qualification_file_url ? (
                          <Pressable onPress={() => openHref(coach.qualification_file_url)} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                            <Text style={styles.inlineSecondaryButtonText}>Open qualification file</Text>
                          </Pressable>
                        ) : null}
                        {coach.background_check_file_url ? (
                          <Pressable onPress={() => openHref(coach.background_check_file_url)} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                            <Text style={styles.inlineSecondaryButtonText}>Open background file</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabelLight}>Verification notes</Text>
                        <TextInput
                          multiline={true}
                          onChangeText={(value) => onVerificationNoteChange(coach.id, value)}
                          placeholder="Add approval/rejection notes"
                          placeholderTextColor="#64748b"
                          style={[styles.inputDark, styles.notesInput]}
                          value={noteDraft}
                        />
                      </View>

                      <View style={styles.inlineButtonRow}>
                        <Pressable
                          disabled={verificationSubmittingId === coach.id}
                          onPress={() => onUpdateVerification(coach, 'verified')}
                          style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || verificationSubmittingId === coach.id) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlinePrimaryButtonText}>Approve</Text>
                        </Pressable>

                        <Pressable
                          disabled={verificationSubmittingId === coach.id}
                          onPress={() => onUpdateVerification(coach, 'rejected')}
                          style={({ pressed }) => [styles.inlineDangerButton, (pressed || verificationSubmittingId === coach.id) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlineDangerButtonText}>Reject</Text>
                        </Pressable>

                        <Pressable
                          disabled={verificationSubmittingId === coach.id}
                          onPress={() => onUpdateVerification(coach, 'pending')}
                          style={({ pressed }) => [styles.inlineSecondaryButton, (pressed || verificationSubmittingId === coach.id) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlineSecondaryButtonText}>Mark pending</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }) : <Text style={styles.cardCopy}>No coaches found for this verification status.</Text>}
                {verifications.length < verificationTotal ? (
                  <Pressable onPress={onLoadMoreVerifications} style={({ pressed }) => [styles.inlineActionButton, styles.loadMoreButton, pressed && styles.actionButtonPressed]}>
                    <Text style={styles.inlineActionButtonText}>Load more verifications</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Hard delete snapshots</Text>
                <Text style={styles.metaCaption}>{snapshotsTotal} total</Text>
                {snapshots.length > 0 ? snapshots.map((s) => (
                  <View key={s.id} style={styles.availabilityCard}>
                    <Text style={styles.compactListTitle}>User: {s.user_id}</Text>
                    <Text style={styles.compactListMeta}>Deleted: {formatFullDateTime(s.created_at)}</Text>
                    {s.reason ? <Text style={styles.compactListMeta}>Reason: {s.reason}</Text> : null}
                  </View>
                )) : <Text style={styles.cardCopy}>No snapshots yet.</Text>}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Signup attempts</Text>
                <Text style={styles.metaCaption}>Showing {signupAttempts.length} of {signupTotal}</Text>
                {signupAttempts.length > 0 ? signupAttempts.map((attempt) => (
                  <View key={attempt.id} style={styles.availabilityCard}>
                    <Text style={styles.compactListTitle}>{attempt.user_email || 'unknown'} — <Text style={attempt.success ? styles.successTextLight : styles.errorTextLight}>{attempt.success ? 'success' : 'failed'}</Text></Text>
                    <Text style={styles.compactListMeta}>{formatFullDateTime(attempt.timestamp || attempt.created_at)} • {attempt.event_type || 'signup'}</Text>
                    <Text style={styles.compactListMeta}>Source: {attempt.signup_source || 'unknown'}</Text>
                    {!attempt.success && attempt.error_details ? <Text style={styles.errorTextLight}>{String(attempt.error_details)}</Text> : null}
                  </View>
                )) : <Text style={styles.cardCopy}>No signup attempts logged yet.</Text>}
                {signupAttempts.length < signupTotal ? (
                  <Pressable onPress={onLoadMoreSignupAttempts} style={({ pressed }) => [styles.inlineActionButton, styles.loadMoreButton, pressed && styles.actionButtonPressed]}>
                    <Text style={styles.inlineActionButtonText}>Load more</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function AdminVerificationsScreen({
  verifications,
  verificationFilter,
  verificationTotal,
  verificationNotes,
  verificationSubmittingId,
  verificationError,
  verificationSuccess,
  loading,
  errorMessage,
  onBack,
  onRefresh,
  onVerificationFilterChange,
  onVerificationNoteChange,
  onUpdateVerification,
  onLoadMoreVerifications,
}) {
  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Coach Verifications</Text>
        <Text style={styles.signInTitleDark}>Pending verification queue</Text>
        <Text style={styles.signInSubtitleDark}>Review and approve or reject coach verification submissions.</Text>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading verifications...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coach verifications</Text>

            <View style={styles.filterToggleRow}>
              {adminVerificationFilterOptions.map((status) => (
                <Pressable
                  key={status}
                  onPress={() => onVerificationFilterChange(status)}
                  style={[styles.filterToggle, verificationFilter === status && styles.recipientToggleActive]}
                >
                  <Text style={[styles.recipientToggleText, verificationFilter === status && styles.recipientToggleTextActive]}>{formatStatusLabel(status)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.metaCaption}>Showing {verifications.length} of {verificationTotal}</Text>

            {verificationError ? <Text style={styles.errorTextLight}>{verificationError}</Text> : null}
            {verificationSuccess ? <Text style={styles.successTextLight}>{verificationSuccess}</Text> : null}

            {verifications.length > 0 ? verifications.map((coach) => {
              const noteDraft = verificationNotes[coach.id] ?? (coach.verification_notes || '');
              return (
                <View key={coach.id} style={styles.availabilityCard}>
                  <Text style={styles.compactListTitle}>{coach.full_name || coach.email || 'Coach'}</Text>
                  <Text style={styles.compactListMeta}>Qualification: {formatStatusLabel(coach.qualification_status)}</Text>
                  <Text style={styles.compactListMeta}>Background: {coach.has_background_check ? formatStatusLabel(coach.background_check_status) : 'Not required'}</Text>

                  <View style={styles.inlineButtonRow}>
                    {coach.qualification_file_url ? (
                      <Pressable onPress={() => openHref(coach.qualification_file_url)} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                        <Text style={styles.inlineSecondaryButtonText}>Open qualification file</Text>
                      </Pressable>
                    ) : null}
                    {coach.background_check_file_url ? (
                      <Pressable onPress={() => openHref(coach.background_check_file_url)} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                        <Text style={styles.inlineSecondaryButtonText}>Open background file</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabelLight}>Verification notes</Text>
                    <TextInput
                      multiline={true}
                      onChangeText={(value) => onVerificationNoteChange(coach.id, value)}
                      placeholder="Add approval/rejection notes"
                      placeholderTextColor="#64748b"
                      style={[styles.inputDark, styles.notesInput]}
                      value={noteDraft}
                    />
                  </View>

                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      disabled={verificationSubmittingId === coach.id}
                      onPress={() => onUpdateVerification(coach, 'verified')}
                      style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || verificationSubmittingId === coach.id) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlinePrimaryButtonText}>Approve</Text>
                    </Pressable>

                    <Pressable
                      disabled={verificationSubmittingId === coach.id}
                      onPress={() => onUpdateVerification(coach, 'rejected')}
                      style={({ pressed }) => [styles.inlineDangerButton, (pressed || verificationSubmittingId === coach.id) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlineDangerButtonText}>Reject</Text>
                    </Pressable>

                    <Pressable
                      disabled={verificationSubmittingId === coach.id}
                      onPress={() => onUpdateVerification(coach, 'pending')}
                      style={({ pressed }) => [styles.inlineSecondaryButton, (pressed || verificationSubmittingId === coach.id) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlineSecondaryButtonText}>Mark pending</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }) : <Text style={styles.cardCopy}>No coaches found for this verification status.</Text>}

            {verifications.length < verificationTotal ? (
              <Pressable onPress={onLoadMoreVerifications} style={({ pressed }) => [styles.inlineActionButton, styles.loadMoreButton, pressed && styles.actionButtonPressed]}>
                <Text style={styles.inlineActionButtonText}>Load more verifications</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function AdminAuditLogsScreen({
  auditLogs,
  auditTotal,
  auditAction,
  loading,
  errorMessage,
  onBack,
  onRefresh,
  onActionFilterChange,
  onLoadMore,
}) {
  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Audit Logs</Text>
        <Text style={styles.signInTitleDark}>Admin action history</Text>
        <Text style={styles.signInSubtitleDark}>Recent admin actions recorded on the platform.</Text>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading audit logs...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Admin actions</Text>

            <View style={styles.filterToggleRow}>
              {adminAuditActionOptions.map((action) => (
                <Pressable
                  key={action}
                  onPress={() => onActionFilterChange(action)}
                  style={[styles.filterToggle, auditAction === action && styles.recipientToggleActive]}
                >
                  <Text style={[styles.recipientToggleText, auditAction === action && styles.recipientToggleTextActive]}>{formatStatusLabel(action)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.metaCaption}>Showing {auditLogs.length} of {auditTotal}</Text>

            {auditLogs.length > 0 ? auditLogs.map((entry) => (
              <View key={entry.id} style={styles.availabilityCard}>
                <Text style={styles.compactListTitle}>{formatStatusLabel(entry.action)}</Text>
                <Text style={styles.compactListMeta}>{formatFullDateTime(entry.created_at)}</Text>
                {entry.actor_name ? <Text style={styles.compactListMeta}>Actor: {entry.actor_name}</Text> : null}
                {entry.target_name ? <Text style={styles.compactListMeta}>Target: {entry.target_name}</Text> : null}
                {entry.metadata?.reason ? <Text style={styles.compactListMeta}>Reason: {entry.metadata.reason}</Text> : null}
              </View>
            )) : <Text style={styles.cardCopy}>No audit log entries found.</Text>}

            {auditLogs.length < auditTotal ? (
              <Pressable onPress={onLoadMore} style={({ pressed }) => [styles.inlineActionButton, styles.loadMoreButton, pressed && styles.actionButtonPressed]}>
                <Text style={styles.inlineActionButtonText}>Load more</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function HelpScreen({
  profile,
  faqs,
  allFaqs,
  loading,
  errorMessage,
  searchTerm,
  category,
  expandedIds,
  editorEntry,
  editorSaving,
  editorError,
  onBack,
  onRefresh,
  onSearchChange,
  onCategoryChange,
  onToggleExpand,
  onOpenMessages,
  onStartAdd,
  onStartEdit,
  onDeleteFaq,
  onSaveEditor,
  onCancelEditor,
  onEditorChange,
}) {
  const userType = normalizeUserType(profile?.user_type);
  const isAdmin = userType === 'admin';
  const roleLabel = userType === 'coach' ? 'coach' : userType === 'admin' ? 'admin' : 'client';

  const filtered = faqs.filter(item => {
    const matchesRole = item.role === roleLabel || item.role === 'both' || item.role === 'admin' || isAdmin;
    if (!matchesRole) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredAllFaqs = allFaqs.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    }
    return true;
  });

  const categories = ['all', ...Array.from(new Set(faqs.map(f => f.category).filter(Boolean)))];
  const editorRoles = ['coach', 'client', 'admin', 'both'];
  const editorCategories = Object.keys(helpCategoryLabels).filter(k => k !== 'all');
  const isNewEntry = editorEntry && !editorEntry.uuid;

  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Help & FAQs</Text>
        <Text style={styles.signInTitleDark}>{isAdmin ? 'Manage help content' : 'Help & support'}</Text>
        <Text style={styles.signInSubtitleDark}>
          {isAdmin ? 'Manage help content and review support topics.' : `Answers and guidance for ${roleLabel}s.`}
        </Text>

        {/* Search */}
        <TextInput
          style={[styles.inputDark, { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 }]}
          placeholder="Search FAQs…"
          placeholderTextColor="#4b5563"
          value={searchTerm}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
          {categories.map(cat => (
            <Pressable
              key={cat}
              onPress={() => onCategoryChange(cat)}
              style={[styles.filterToggle, category === cat && styles.recipientToggleActive]}
            >
              <Text style={[styles.recipientToggleText, category === cat && styles.recipientToggleTextActive]}>
                {helpCategoryLabels[cat] || cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {errorMessage ? (
          <>
            <Text style={styles.errorTextLight}>{errorMessage}</Text>
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
              <Text style={styles.inlineActionButtonText}>Retry</Text>
            </Pressable>
          </>
        ) : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading FAQs…</Text>
          </View>
        ) : null}

        {/* Admin: Manage FAQs */}
        {isAdmin && (
          <View style={[styles.card, { marginTop: 4, marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={styles.cardTitle}>Manage FAQs</Text>
              <Pressable onPress={onStartAdd} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
                <Text style={styles.inlineActionButtonText}>+ Add FAQ</Text>
              </Pressable>
            </View>

            {/* Inline editor */}
            {editorEntry && (
              <View style={{ borderTopWidth: 1, borderColor: '#1e3a5f', paddingTop: 14, marginBottom: 12 }}>
                <Text style={[styles.metaCaption, { marginBottom: 10 }]}>{isNewEntry ? 'New FAQ' : 'Edit FAQ'}</Text>
                <Text style={styles.inputLabelLight}>Question</Text>
                <TextInput
                  style={[styles.inputDark, { marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10 }]}
                  value={editorEntry.q}
                  onChangeText={t => onEditorChange('q', t)}
                  placeholder="Question…"
                  placeholderTextColor="#4b5563"
                  multiline
                />
                <Text style={styles.inputLabelLight}>Answer</Text>
                <TextInput
                  style={[styles.inputDark, { height: 90, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10 }]}
                  value={editorEntry.a}
                  onChangeText={t => onEditorChange('a', t)}
                  placeholder="Answer…"
                  placeholderTextColor="#4b5563"
                  multiline
                  textAlignVertical="top"
                />
                <Text style={[styles.inputLabelLight, { marginBottom: 6 }]}>Role</Text>
                <View style={[styles.filterToggleRow, { marginBottom: 10 }]}>
                  {editorRoles.map(r => (
                    <Pressable key={r} onPress={() => onEditorChange('role', r)} style={[styles.filterToggle, editorEntry.role === r && styles.recipientToggleActive]}>
                      <Text style={[styles.recipientToggleText, editorEntry.role === r && styles.recipientToggleTextActive]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.inputLabelLight, { marginBottom: 6 }]}>Category</Text>
                <View style={[styles.filterToggleRow, { marginBottom: 10 }]}>
                  {editorCategories.map(c => (
                    <Pressable key={c} onPress={() => onEditorChange('category', c)} style={[styles.filterToggle, editorEntry.category === c && styles.recipientToggleActive]}>
                      <Text style={[styles.recipientToggleText, editorEntry.category === c && styles.recipientToggleTextActive]}>{helpCategoryLabels[c] || c}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={[styles.filterToggleRow, { marginBottom: 12 }]}>
                  <Pressable onPress={() => onEditorChange('is_active', !editorEntry.is_active)} style={[styles.filterToggle, editorEntry.is_active && styles.recipientToggleActive]}>
                    <Text style={[styles.recipientToggleText, editorEntry.is_active && styles.recipientToggleTextActive]}>Active</Text>
                  </Pressable>
                </View>
                {editorError ? <Text style={[styles.errorTextLight, { marginBottom: 8 }]}>{editorError}</Text> : null}
                <View style={styles.inlineButtonRow}>
                  <Pressable onPress={onSaveEditor} disabled={editorSaving} style={[styles.inlinePrimaryButton, { flex: 1, opacity: editorSaving ? 0.6 : 1 }]}>
                    <Text style={styles.inlinePrimaryButtonText}>{editorSaving ? 'Saving…' : 'Save'}</Text>
                  </Pressable>
                  <Pressable onPress={onCancelEditor} style={[styles.inlineSecondaryButton, { flex: 1 }]}>
                    <Text style={styles.inlineSecondaryButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* All FAQs list */}
            {filteredAllFaqs.length === 0 && !loading && !editorEntry && (
              <Text style={styles.cardCopy}>{category !== 'all' || searchTerm ? 'No FAQs match your filter.' : 'No FAQs yet. Tap + Add FAQ to create one.'}</Text>
            )}
            {filteredAllFaqs.map(faq => (
              <View key={faq.id} style={{ borderTopWidth: 1, borderColor: '#1e3a5f', paddingTop: 10, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.compactListTitle}>{faq.q}</Text>
                    <Text style={[styles.compactListMeta, { marginTop: 2 }]} numberOfLines={1}>{faq.role} · {helpCategoryLabels[faq.category] || faq.category} · {faq.is_active ? 'active' : 'hidden'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                    <Pressable onPress={() => onStartEdit(faq)} style={({ pressed }) => [styles.selectionChip, pressed && styles.actionButtonPressed]}>
                      <Text style={styles.selectionChipText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteFaq(faq)} style={({ pressed }) => [styles.selectionChip, { backgroundColor: '#7f1d1d', borderColor: '#7f1d1d' }, pressed && styles.actionButtonPressed]}>
                      <Text style={[styles.selectionChipText, { color: '#fca5a5' }]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* FAQ accordion */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
          {filtered.length === 0 && !loading && (
            <Text style={styles.cardCopy}>{searchTerm ? 'No results for your search.' : 'No FAQs available.'}</Text>
          )}
          {filtered.map(item => {
            const expanded = expandedIds.includes(item.id);
            return (
              <Pressable key={item.id} onPress={() => onToggleExpand(item.id)} style={{ borderTopWidth: 1, borderColor: '#1e3a5f', paddingVertical: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={[styles.compactListTitle, { flex: 1, marginRight: 8 }]}>{item.q}</Text>
                  <Text style={{ color: '#f59e0b', fontSize: 20, lineHeight: 24 }}>{expanded ? '−' : '+'}</Text>
                </View>
                {expanded && (
                  <Text style={[styles.cardCopy, { marginTop: 8, lineHeight: 20 }]}>{item.a}</Text>
                )}
                <Text style={[styles.metaCaption, { marginTop: 4 }]}>{helpCategoryLabels[item.category] || item.category}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Still Need Help? */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.cardTitle}>Still Need Help?</Text>
          <Text style={[styles.cardCopy, { marginBottom: 14 }]}>
            Our support team is available to help with any questions not covered above.
          </Text>
          <Pressable onPress={onOpenMessages} style={({ pressed }) => [styles.inlinePrimaryButton, { marginBottom: 10 }, pressed && styles.actionButtonPressed]}>
            <Text style={styles.inlinePrimaryButtonText}>Open Messages</Text>
          </Pressable>
          <Pressable onPress={() => openHref('mailto:support@findacoachtoday.com')} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
            <Text style={styles.inlineSecondaryButtonText}>Email support@findacoachtoday.com</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function CoachOperationsScreen({
  profile,
  profileForm,
  complianceForm,
  availability,
  recurringAvailability,
  availabilityForm,
  recurringForm,
  loading,
  errorMessage,
  profileSubmitting,
  profileError,
  complianceSubmitting,
  complianceError,
  uploadSubmitting,
  uploadError,
  availabilitySubmitting,
  availabilityError,
  recurringSubmitting,
  recurringError,
  onBack,
  onRefresh,
  onProfileChange,
  onProfileToggle,
  onSaveProfile,
  onComplianceChange,
  onAvailabilityFormChange,
  onRecurringFormChange,
  onSaveCompliance,
  onUploadComplianceDocument,
  onSaveAvailability,
  onSaveRecurring,
  onEditAvailability,
  onDeleteAvailability,
  onEditRecurring,
  onDeleteRecurring,
  onResetAvailabilityForm,
  onResetRecurringForm,
}) {
  const qualificationStatus = formatStatusLabel(profile?.qualification_status);
  const backgroundStatus = profile?.has_background_check
    ? formatStatusLabel(profile?.background_check_status)
    : 'Not provided';
  const clip1Status = normalizeVideoUrl(profileForm.video_clip_1);
  const clip2Status = normalizeVideoUrl(profileForm.video_clip_2);
  const clip3Status = normalizeVideoUrl(profileForm.video_clip_3);

  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Coach Operations</Text>
        <Text style={styles.signInTitleDark}>Compliance and availability on device</Text>
        <Text style={styles.signInSubtitleDark}>Manage the coach-side operational work that already has stable backend support, without dropping back to the browser.</Text>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh coach tools</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading coach operations...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Qualification</Text>
                <Text style={styles.statValueSmall}>{qualificationStatus}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Background Check</Text>
                <Text style={styles.statValueSmall}>{backgroundStatus}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Availability Blocks</Text>
                <Text style={styles.statValue}>{availability.length}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Recurring Slots</Text>
                <Text style={styles.statValue}>{recurringAvailability.length}</Text>
              </View>
            </View>

            <View style={styles.featureGrid}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Public coach profile</Text>

                <View style={styles.dualInputRow}>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>Full name</Text>
                    <TextInput
                      onChangeText={(value) => onProfileChange('full_name', value)}
                      placeholder="Coach name"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={profileForm.full_name}
                    />
                  </View>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>Phone</Text>
                    <TextInput
                      onChangeText={(value) => onProfileChange('phone', value)}
                      placeholder="+44..."
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={profileForm.phone}
                    />
                  </View>
                </View>

                <View style={styles.dualInputRow}>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>Country</Text>
                    <TextInput
                      onChangeText={(value) => onProfileChange('country', value)}
                      placeholder="Country"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={profileForm.country}
                    />
                  </View>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>City</Text>
                    <TextInput
                      onChangeText={(value) => onProfileChange('city', value)}
                      placeholder="City"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={profileForm.city}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Address</Text>
                  <TextInput
                    onChangeText={(value) => onProfileChange('location', value)}
                    placeholder="Full address or base training location"
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={profileForm.location}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Public bio</Text>
                  <TextInput
                    multiline={true}
                    onChangeText={(value) => onProfileChange('bio', value)}
                    placeholder="Describe your coaching background and approach"
                    placeholderTextColor="#64748b"
                    style={[styles.inputDark, styles.notesInput]}
                    value={profileForm.bio}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Hourly rate (£)</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(value) => onProfileChange('hourly_rate', value)}
                    placeholder="50"
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={profileForm.hourly_rate}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Video clip 1 URL (YouTube or Vimeo)</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="url"
                    onChangeText={(value) => onProfileChange('video_clip_1', value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={profileForm.video_clip_1}
                  />
                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      disabled={!profileForm.video_clip_1 || !clip1Status.ok}
                      onPress={() => openHref(profileForm.video_clip_1)}
                      style={({ pressed }) => [styles.inlineSecondaryButton, (!profileForm.video_clip_1 || !clip1Status.ok || pressed) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlineSecondaryButtonText}>Open clip 1</Text>
                    </Pressable>
                  </View>
                  {!profileForm.video_clip_1 ? (
                    <Text style={styles.helperText}>Optional link.</Text>
                  ) : clip1Status.ok ? (
                    <Text style={styles.helperText}>Valid YouTube/Vimeo link.</Text>
                  ) : (
                    <Text style={styles.errorTextLight}>{clip1Status.error}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Video clip 2 URL (optional)</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="url"
                    onChangeText={(value) => onProfileChange('video_clip_2', value)}
                    placeholder="https://youtu.be/..."
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={profileForm.video_clip_2}
                  />
                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      disabled={!profileForm.video_clip_2 || !clip2Status.ok}
                      onPress={() => openHref(profileForm.video_clip_2)}
                      style={({ pressed }) => [styles.inlineSecondaryButton, (!profileForm.video_clip_2 || !clip2Status.ok || pressed) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlineSecondaryButtonText}>Open clip 2</Text>
                    </Pressable>
                  </View>
                  {!profileForm.video_clip_2 ? null : clip2Status.ok ? (
                    <Text style={styles.helperText}>Valid YouTube/Vimeo link.</Text>
                  ) : (
                    <Text style={styles.errorTextLight}>{clip2Status.error}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Video clip 3 URL (optional)</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="url"
                    onChangeText={(value) => onProfileChange('video_clip_3', value)}
                    placeholder="https://vimeo.com/..."
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={profileForm.video_clip_3}
                  />
                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      disabled={!profileForm.video_clip_3 || !clip3Status.ok}
                      onPress={() => openHref(profileForm.video_clip_3)}
                      style={({ pressed }) => [styles.inlineSecondaryButton, (!profileForm.video_clip_3 || !clip3Status.ok || pressed) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlineSecondaryButtonText}>Open clip 3</Text>
                    </Pressable>
                  </View>
                  {!profileForm.video_clip_3 ? null : clip3Status.ok ? (
                    <Text style={styles.helperText}>Valid YouTube/Vimeo link.</Text>
                  ) : (
                    <Text style={styles.errorTextLight}>{clip3Status.error}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Services offered</Text>
                  <View style={styles.chipGrid}>
                    {coachingTypes.map((item) => (
                      <Pressable
                        key={item.value}
                        onPress={() => onProfileToggle('services_offered', item.value)}
                        style={[
                          styles.selectionChip,
                          profileForm.services_offered.includes(item.value) && styles.selectionChipActive,
                        ]}
                      >
                        <Text style={[
                          styles.selectionChipText,
                          profileForm.services_offered.includes(item.value) && styles.selectionChipTextActive,
                        ]}>{item.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Age groups coached</Text>
                  <View style={styles.chipGrid}>
                    {ageGroups.map((item) => (
                      <Pressable
                        key={item.value}
                        onPress={() => onProfileToggle('age_groups', item.value)}
                        style={[
                          styles.selectionChip,
                          profileForm.age_groups.includes(item.value) && styles.selectionChipActive,
                        ]}
                      >
                        <Text style={[
                          styles.selectionChipText,
                          profileForm.age_groups.includes(item.value) && styles.selectionChipTextActive,
                        ]}>{item.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {profileError ? <Text style={styles.errorTextLight}>{profileError}</Text> : null}

                <Pressable
                  disabled={profileSubmitting}
                  onPress={onSaveProfile}
                  style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || profileSubmitting) && styles.actionButtonPressed]}
                >
                  <Text style={styles.actionTitle}>Save public profile</Text>
                  <Text style={styles.actionBody}>Update the same coach profile fields used by the web profile editor.</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Compliance snapshot</Text>
                <Text style={styles.cardCopy}>Qualification status: {qualificationStatus}</Text>
                <Text style={styles.cardCopy}>Background check status: {backgroundStatus}</Text>
                <Text style={styles.cardCopy}>Expiry: {profile?.background_check_expires_at ? formatSessionDate(profile.background_check_expires_at) : 'Not set'}</Text>
                <Text style={styles.cardCopy}>Qualification file: {complianceForm.qualification_file_url ? 'Uploaded' : 'Missing'}</Text>
                <Text style={styles.cardCopy}>Background file: {complianceForm.background_check_file_url ? 'Uploaded' : 'Missing'}</Text>
                {profile?.verification_notes ? (
                  <Text style={styles.cardCopy}>Verification notes: {profile.verification_notes}</Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Update compliance</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Qualification type</Text>
                  <TextInput
                    onChangeText={(value) => onComplianceChange('qualification_type', value)}
                    placeholder="UEFA B, FA Level 2, academy coach..."
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={complianceForm.qualification_type}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Qualification document</Text>
                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      disabled={uploadSubmitting}
                      onPress={() => onUploadComplianceDocument('qualification')}
                      style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || uploadSubmitting) && styles.actionButtonPressed]}
                    >
                      <Text style={styles.inlinePrimaryButtonText}>Upload qualification file</Text>
                    </Pressable>
                  </View>
                  {complianceForm.qualification_file_url ? (
                    <Text style={styles.helperText}>Qualification file selected and uploaded.</Text>
                  ) : (
                    <Text style={styles.helperText}>Allowed formats: PDF, JPG, PNG.</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Background check recorded</Text>
                  <View style={styles.recipientToggleRow}>
                    <Pressable
                      onPress={() => onComplianceChange('has_background_check', true)}
                      style={[styles.recipientToggle, complianceForm.has_background_check && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, complianceForm.has_background_check && styles.recipientToggleTextActive]}>Yes</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onComplianceChange('has_background_check', false)}
                      style={[styles.recipientToggle, !complianceForm.has_background_check && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, !complianceForm.has_background_check && styles.recipientToggleTextActive]}>No</Text>
                    </Pressable>
                  </View>
                </View>

                {complianceForm.has_background_check ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabelLight}>Background check type</Text>
                      <TextInput
                        onChangeText={(value) => onComplianceChange('background_check_type', value)}
                        placeholder="DBS, PVG, Garda vetting..."
                        placeholderTextColor="#64748b"
                        style={styles.inputDark}
                        value={complianceForm.background_check_type}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabelLight}>Background check document</Text>
                      <View style={styles.inlineButtonRow}>
                        <Pressable
                          disabled={uploadSubmitting}
                          onPress={() => onUploadComplianceDocument('background_check')}
                          style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || uploadSubmitting) && styles.actionButtonPressed]}
                        >
                          <Text style={styles.inlinePrimaryButtonText}>Upload background file</Text>
                        </Pressable>
                      </View>
                      {complianceForm.background_check_file_url ? (
                        <Text style={styles.helperText}>Background check file selected and uploaded.</Text>
                      ) : (
                        <Text style={styles.helperText}>Required when background check is marked as recorded.</Text>
                      )}
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabelLight}>Expiry date</Text>
                      <TextInput
                        onChangeText={(value) => onComplianceChange('background_check_expires_at', value)}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#64748b"
                        style={styles.inputDark}
                        value={complianceForm.background_check_expires_at}
                      />
                    </View>

                    <Text style={styles.helperText}>After uploading files here, tap Save compliance details to submit them for review.</Text>
                  </>
                ) : null}

                {uploadError ? <Text style={styles.errorTextLight}>{uploadError}</Text> : null}
                {complianceError ? <Text style={styles.errorTextLight}>{complianceError}</Text> : null}

                <Pressable
                  disabled={complianceSubmitting}
                  onPress={onSaveCompliance}
                  style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || complianceSubmitting) && styles.actionButtonPressed]}
                >
                  <Text style={styles.actionTitle}>Save compliance details</Text>
                  <Text style={styles.actionBody}>Send the live compliance metadata update through the shared profile endpoint.</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{availabilityForm.id ? 'Edit availability block' : 'Create availability block'}</Text>

                <View style={styles.dualInputRow}>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>Start date</Text>
                    <TextInput
                      onChangeText={(value) => onAvailabilityFormChange('startDate', value)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={availabilityForm.startDate}
                    />
                  </View>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>Start time</Text>
                    <TextInput
                      onChangeText={(value) => onAvailabilityFormChange('startTime', value)}
                      placeholder="09:00"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={availabilityForm.startTime}
                    />
                  </View>
                </View>

                <View style={styles.dualInputRow}>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>End date</Text>
                    <TextInput
                      onChangeText={(value) => onAvailabilityFormChange('endDate', value)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={availabilityForm.endDate}
                    />
                  </View>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>End time</Text>
                    <TextInput
                      onChangeText={(value) => onAvailabilityFormChange('endTime', value)}
                      placeholder="10:00"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={availabilityForm.endTime}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Availability type</Text>
                  <View style={styles.recipientToggleRow}>
                    <Pressable
                      onPress={() => onAvailabilityFormChange('isAvailable', true)}
                      style={[styles.recipientToggle, availabilityForm.isAvailable && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, availabilityForm.isAvailable && styles.recipientToggleTextActive]}>Available</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onAvailabilityFormChange('isAvailable', false)}
                      style={[styles.recipientToggle, !availabilityForm.isAvailable && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, !availabilityForm.isAvailable && styles.recipientToggleTextActive]}>Unavailable</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Location override</Text>
                  <TextInput
                    onChangeText={(value) => onAvailabilityFormChange('locationOverride', value)}
                    placeholder="Pitch, gym, online, travel area..."
                    placeholderTextColor="#64748b"
                    style={styles.inputDark}
                    value={availabilityForm.locationOverride}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Notes</Text>
                  <TextInput
                    multiline={true}
                    onChangeText={(value) => onAvailabilityFormChange('notes', value)}
                    placeholder="Add context for clients or admin staff"
                    placeholderTextColor="#64748b"
                    style={[styles.inputDark, styles.notesInput]}
                    value={availabilityForm.notes}
                  />
                </View>

                {availabilityError ? <Text style={styles.errorTextLight}>{availabilityError}</Text> : null}

                <View style={styles.inlineButtonRow}>
                  <Pressable
                    disabled={availabilitySubmitting}
                    onPress={onSaveAvailability}
                    style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || availabilitySubmitting) && styles.actionButtonPressed]}
                  >
                    <Text style={styles.inlinePrimaryButtonText}>{availabilityForm.id ? 'Update block' : 'Create block'}</Text>
                  </Pressable>

                  <Pressable onPress={onResetAvailabilityForm} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                    <Text style={styles.inlineSecondaryButtonText}>{availabilityForm.id ? 'Cancel edit' : 'Clear form'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Upcoming availability</Text>
                {availability.length > 0 ? availability.map((item) => (
                  <View key={item.id} style={styles.availabilityCard}>
                    <Text style={styles.compactListTitle}>{formatAvailabilityWindow(item)}</Text>
                    <Text style={styles.compactListMeta}>{item.is_available === false ? 'Unavailable block' : 'Available block'}</Text>
                    {item.location_override ? <Text style={styles.compactListMeta}>Location: {item.location_override}</Text> : null}
                    {item.notes ? <Text style={styles.compactListMeta}>{item.notes}</Text> : null}
                    <View style={styles.inlineButtonRow}>
                      <Pressable onPress={() => onEditAvailability(item)} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                        <Text style={styles.inlineSecondaryButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => onDeleteAvailability(item)} style={({ pressed }) => [styles.inlineDangerButton, pressed && styles.actionButtonPressed]}>
                        <Text style={styles.inlineDangerButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                )) : <Text style={styles.cardCopy}>No one-off availability blocks yet.</Text>}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{recurringForm.id ? 'Edit recurring slot' : 'Create recurring slot'}</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Day of week</Text>
                  <View style={styles.chipGrid}>
                    {[
                      { value: '0', label: 'Sun' },
                      { value: '1', label: 'Mon' },
                      { value: '2', label: 'Tue' },
                      { value: '3', label: 'Wed' },
                      { value: '4', label: 'Thu' },
                      { value: '5', label: 'Fri' },
                      { value: '6', label: 'Sat' },
                    ].map((day) => (
                      <Pressable
                        key={day.value}
                        onPress={() => onRecurringFormChange('dayOfWeek', day.value)}
                        style={[
                          styles.selectionChip,
                          recurringForm.dayOfWeek === day.value && styles.selectionChipActive,
                        ]}
                      >
                        <Text style={[
                          styles.selectionChipText,
                          recurringForm.dayOfWeek === day.value && styles.selectionChipTextActive,
                        ]}>{day.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.dualInputRow}>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>Start time</Text>
                    <TextInput
                      onChangeText={(value) => onRecurringFormChange('startTime', value)}
                      placeholder="09:00"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={recurringForm.startTime}
                    />
                  </View>
                  <View style={styles.dualInputColumn}>
                    <Text style={styles.inputLabelLight}>End time</Text>
                    <TextInput
                      onChangeText={(value) => onRecurringFormChange('endTime', value)}
                      placeholder="10:00"
                      placeholderTextColor="#64748b"
                      style={styles.inputDark}
                      value={recurringForm.endTime}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelLight}>Slot status</Text>
                  <View style={styles.recipientToggleRow}>
                    <Pressable
                      onPress={() => onRecurringFormChange('isActive', true)}
                      style={[styles.recipientToggle, recurringForm.isActive && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, recurringForm.isActive && styles.recipientToggleTextActive]}>Active</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onRecurringFormChange('isActive', false)}
                      style={[styles.recipientToggle, !recurringForm.isActive && styles.recipientToggleActive]}
                    >
                      <Text style={[styles.recipientToggleText, !recurringForm.isActive && styles.recipientToggleTextActive]}>Paused</Text>
                    </Pressable>
                  </View>
                </View>

                {recurringError ? <Text style={styles.errorTextLight}>{recurringError}</Text> : null}

                <View style={styles.inlineButtonRow}>
                  <Pressable
                    disabled={recurringSubmitting}
                    onPress={onSaveRecurring}
                    style={({ pressed }) => [styles.inlinePrimaryButton, (pressed || recurringSubmitting) && styles.actionButtonPressed]}
                  >
                    <Text style={styles.inlinePrimaryButtonText}>{recurringForm.id ? 'Update recurring slot' : 'Create recurring slot'}</Text>
                  </Pressable>

                  <Pressable onPress={onResetRecurringForm} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                    <Text style={styles.inlineSecondaryButtonText}>{recurringForm.id ? 'Cancel edit' : 'Clear form'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Weekly recurring schedule</Text>
                {recurringAvailability.length > 0 ? recurringAvailability.map((item) => (
                  <View key={item.id} style={styles.availabilityCard}>
                    <Text style={styles.compactListTitle}>{formatRecurringAvailabilityWindow(item)}</Text>
                    <Text style={styles.compactListMeta}>{item.is_active === false ? 'Paused recurring slot' : 'Active recurring slot'}</Text>
                    <View style={styles.inlineButtonRow}>
                      <Pressable onPress={() => onEditRecurring(item)} style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}>
                        <Text style={styles.inlineSecondaryButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => onDeleteRecurring(item)} style={({ pressed }) => [styles.inlineDangerButton, pressed && styles.actionButtonPressed]}>
                        <Text style={styles.inlineDangerButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                )) : <Text style={styles.cardCopy}>No recurring weekly slots yet.</Text>}
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const COACH_BOOKING_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'history', label: 'History' },
];

const CLIENT_BOOKING_TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
];

function filterDashboardBookings(bookings, tab, accountType) {
  const now = new Date();
  if (accountType === 'coach') {
    if (tab === 'pending') return bookings.filter(b => b.status === 'pending');
    if (tab === 'upcoming') return bookings.filter(b => b.status === 'confirmed' || b.status === 'in_session');
    if (tab === 'history') return bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');
  }
  if (accountType === 'client') {
    if (tab === 'upcoming') {
      return bookings.filter(b => {
        const date = new Date(getBookingDateValue(b) || '');
        return (b.status === 'confirmed' || b.status === 'pending') && (isNaN(date.getTime()) || date >= now);
      });
    }
    if (tab === 'past') {
      return bookings.filter(b => {
        const date = new Date(getBookingDateValue(b) || '');
        return b.status === 'completed' || (!isNaN(date.getTime()) && date < now);
      });
    }
    if (tab === 'cancelled') return bookings.filter(b => b.status === 'cancelled');
  }
  return bookings;
}

function FindCoachesScreen({
  coaches,
  loading,
  errorMessage,
  total,
  page,
  pageSize,
  searchQuery,
  serviceType,
  onBack,
  onRefresh,
  onSearch,
  onServiceTypeChange,
  onNextPage,
  onPrevPage,
  onSelectCoach,
}) {
  const [localQuery, setLocalQuery] = React.useState(searchQuery);
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

  React.useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent}>
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Find a Coach</Text>
        <Text style={styles.signInTitleDark}>Browse coaches</Text>
        <Text style={styles.signInSubtitleDark}>Find a football coach and book a session without leaving the app.</Text>

        <View style={styles.searchContainer}>
          <Text style={styles.searchLabel}>Search</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setLocalQuery}
            onSubmitEditing={() => onSearch(localQuery)}
            placeholder="Name, specialty, bio..."
            placeholderTextColor="#64748b"
            returnKeyType="search"
            style={styles.searchInput}
            value={localQuery}
          />
        </View>

        <View style={styles.inlineButtonRow}>
          <Pressable
            onPress={() => onSearch(localQuery)}
            style={({ pressed }) => [styles.inlinePrimaryButton, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.inlinePrimaryButtonText}>Search</Text>
          </Pressable>
          {(localQuery || serviceType) ? (
            <Pressable
              onPress={() => { setLocalQuery(''); onSearch(''); onServiceTypeChange(''); }}
              style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.inlineSecondaryButtonText}>Clear</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [styles.inlineSecondaryButton, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.inlineSecondaryButtonText}>Refresh</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterToggleRow}>
          <Pressable
            onPress={() => onServiceTypeChange('')}
            style={[styles.filterToggle, !serviceType && styles.recipientToggleActive]}
          >
            <Text style={[styles.recipientToggleText, !serviceType && styles.recipientToggleTextActive]}>All types</Text>
          </Pressable>
          {coachingTypes.map(type => (
            <Pressable
              key={type.value}
              onPress={() => onServiceTypeChange(type.value)}
              style={[styles.filterToggle, serviceType === type.value && styles.recipientToggleActive]}
            >
              <Text style={[styles.recipientToggleText, serviceType === type.value && styles.recipientToggleTextActive]}>{type.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {total > 0 ? (
          <Text style={styles.helperText}>Showing {coaches.length} of {total} coaches</Text>
        ) : null}

        {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading coaches...</Text>
          </View>
        ) : coaches.length > 0 ? (
          <>
            <View style={styles.featureGrid}>
              {coaches.map(coach => (
                <Pressable
                  key={coach.id}
                  onPress={() => onSelectCoach(coach)}
                  style={({ pressed }) => [styles.coachCard, pressed && styles.actionButtonPressed]}
                >
                  <View style={styles.coachCardHeader}>
                    <Text style={styles.coachCardName}>{coach.full_name || 'Coach'}</Text>
                    {coach.has_background_check && coach.background_check_status === 'verified' ? (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                      </View>
                    ) : null}
                  </View>
                  {(coach.city || coach.country) ? (
                    <Text style={styles.coachCardMeta}>{[coach.city, coach.country].filter(Boolean).join(', ')}</Text>
                  ) : null}
                  <Text style={styles.coachCardRate}>£{Number(coach.hourly_rate) || 0}/hr</Text>
                  {coach.bio ? (
                    <Text style={styles.coachCardBio} numberOfLines={3}>{coach.bio}</Text>
                  ) : null}
                  {Array.isArray(coach.services_offered) && coach.services_offered.length > 0 ? (
                    <View style={styles.coachCardServices}>
                      {coach.services_offered.slice(0, 3).map(s => {
                        const label = coachingTypes.find(t => t.value === s)?.label || formatServiceType(s);
                        return (
                          <View key={s} style={styles.coachServiceChip}>
                            <Text style={styles.coachServiceChipText}>{label}</Text>
                          </View>
                        );
                      })}
                      {coach.services_offered.length > 3 ? (
                        <View style={styles.coachServiceChip}>
                          <Text style={styles.coachServiceChipText}>+{coach.services_offered.length - 3}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>

            {totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <Pressable
                  disabled={page === 0}
                  onPress={onPrevPage}
                  style={({ pressed }) => [
                    styles.inlineSecondaryButton,
                    { flex: 1 },
                    (pressed || page === 0) && styles.actionButtonPressed,
                    page === 0 && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.inlineSecondaryButtonText}>← Prev</Text>
                </Pressable>
                <Text style={[styles.helperText, { flex: 1, textAlign: 'center', marginBottom: 0 }]}>
                  {page + 1} / {totalPages}
                </Text>
                <Pressable
                  disabled={page + 1 >= totalPages}
                  onPress={onNextPage}
                  style={({ pressed }) => [
                    styles.inlineSecondaryButton,
                    { flex: 1 },
                    (pressed || page + 1 >= totalPages) && styles.actionButtonPressed,
                    page + 1 >= totalPages && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.inlineSecondaryButtonText}>Next →</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardCopy}>No coaches found. Try adjusting your search or filters.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function CoachDetailScreen({ coach, currentUser, onBack, onBook }) {
  const isVerified = coach?.has_background_check && coach?.background_check_status === 'verified';
  const accountType = normalizeUserType(currentUser?.user_type || 'client');
  const canBook = accountType === 'client';
  const services = Array.isArray(coach?.services_offered) ? coach.services_offered : [];

  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent}>
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Coach Profile</Text>
        <Text style={styles.signInTitleDark}>{coach?.full_name || 'Coach'}</Text>
        {(coach?.city || coach?.country) ? (
          <Text style={styles.signInSubtitleDark}>{[coach?.city, coach?.country].filter(Boolean).join(', ')}</Text>
        ) : null}

        <View style={styles.statsGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Rate</Text>
            <Text style={styles.statValue}>£{coach?.hourly_rate || 0}</Text>
          </View>
          {Number(coach?.rating) > 0 ? (
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statValue}>{Number(coach.rating).toFixed(1)}</Text>
            </View>
          ) : null}
          {Number(coach?.total_reviews) > 0 ? (
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Reviews</Text>
              <Text style={styles.statValue}>{coach.total_reviews}</Text>
            </View>
          ) : null}
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Background</Text>
            <Text style={styles.statValueSmall}>{isVerified ? 'Verified ✓' : 'Unverified'}</Text>
          </View>
        </View>

        {coach?.bio ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.cardCopy}>{coach.bio}</Text>
          </View>
        ) : null}

        {services.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Services offered</Text>
            <View style={styles.chipGrid}>
              {services.map(s => {
                const label = coachingTypes.find(t => t.value === s)?.label || formatServiceType(s);
                return (
                  <View key={s} style={styles.selectionChip}>
                    <Text style={styles.selectionChipText}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {coach?.qualification_status === 'verified' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Qualifications</Text>
            <Text style={styles.cardCopy}>Qualification verified ✓</Text>
          </View>
        ) : null}

        <View style={styles.actionGroupSignedIn}>
          {canBook ? (
            <Pressable
              onPress={onBook}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Book a session</Text>
              <Text style={styles.actionBody}>Submit a booking request to this coach.</Text>
            </Pressable>
          ) : accountType === 'coach' ? (
            <View style={styles.card}>
              <Text style={styles.cardCopy}>You are signed in as a coach. A client account is needed to book a session.</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function NewBookingScreen({
  coach,
  serviceType,
  date,
  time,
  locationType,
  locationAddress,
  notes,
  submitting,
  errorMessage,
  successMessage,
  onServiceTypeChange,
  onDateChange,
  onTimeChange,
  onLocationTypeChange,
  onLocationAddressChange,
  onNotesChange,
  onBack,
  onSubmit,
}) {
  const hourlyRate = Number(coach?.hourly_rate || 0);
  const adminFee = 3;
  const total = hourlyRate + adminFee;
  const services = Array.isArray(coach?.services_offered) && coach.services_offered.length > 0
    ? coach.services_offered
    : coachingTypes.map(t => t.value);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.signInHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.signInCardDark}>
          <Text style={styles.sectionEyebrow}>New Booking</Text>
          <Text style={styles.signInTitleDark}>Book {coach?.full_name || 'this coach'}</Text>
          <Text style={styles.signInSubtitleDark}>Submit a session request. The coach will confirm or decline it.</Text>

          {hourlyRate > 0 ? (
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Session rate</Text>
                <Text style={styles.statValueSmall}>£{hourlyRate}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Platform fee</Text>
                <Text style={styles.statValueSmall}>£{adminFee}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statValueSmall}>£{total}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabelLight}>Service type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterToggleRow}>
              {services.map(s => {
                const label = coachingTypes.find(t => t.value === s)?.label || formatServiceType(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => onServiceTypeChange(s)}
                    style={[styles.selectionChip, serviceType === s && styles.selectionChipActive]}
                  >
                    <Text style={[styles.selectionChipText, serviceType === s && styles.selectionChipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.dualInputRow}>
            <View style={styles.dualInputColumn}>
              <Text style={styles.inputLabelLight}>Date</Text>
              <TextInput
                onChangeText={onDateChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
                style={styles.inputDark}
                value={date}
              />
            </View>
            <View style={styles.dualInputColumn}>
              <Text style={styles.inputLabelLight}>Time</Text>
              <TextInput
                onChangeText={onTimeChange}
                placeholder="HH:MM"
                placeholderTextColor="#64748b"
                style={styles.inputDark}
                value={time}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabelLight}>Location</Text>
            <View style={styles.recipientToggleRow}>
              <Pressable
                onPress={() => onLocationTypeChange('online')}
                style={[styles.recipientToggle, locationType === 'online' && styles.recipientToggleActive]}
              >
                <Text style={[styles.recipientToggleText, locationType === 'online' && styles.recipientToggleTextActive]}>Online</Text>
              </Pressable>
              <Pressable
                onPress={() => onLocationTypeChange('in_person')}
                style={[styles.recipientToggle, locationType === 'in_person' && styles.recipientToggleActive]}
              >
                <Text style={[styles.recipientToggleText, locationType === 'in_person' && styles.recipientToggleTextActive]}>In person</Text>
              </Pressable>
            </View>
          </View>

          {locationType === 'in_person' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabelLight}>Address</Text>
              <TextInput
                onChangeText={onLocationAddressChange}
                placeholder="Pitch, training ground..."
                placeholderTextColor="#64748b"
                style={styles.inputDark}
                value={locationAddress}
              />
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabelLight}>Notes for the coach</Text>
            <TextInput
              multiline
              onChangeText={onNotesChange}
              placeholder="Goals, level, anything the coach should know..."
              placeholderTextColor="#64748b"
              style={[styles.inputDark, styles.notesInput]}
              textAlignVertical="top"
              value={notes}
            />
          </View>

          {errorMessage ? <Text style={styles.errorTextLight}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.successTextLight}>{successMessage}</Text> : null}

          <View style={styles.actionGroupSignedIn}>
            <Pressable
              disabled={submitting}
              onPress={onSubmit}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, (pressed || submitting) && styles.actionButtonPressed]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.actionTitle}>Submit booking request</Text>
                  <Text style={styles.actionBody}>Your request will go to the coach for review.</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthenticatedHome({
  currentUser,
  profile,
  loadingProfile,
  dashboardLoading,
  dashboardError,
  dashboard,
  onRefresh,
  onOpenBookings,
  onOpenMessages,
  onOpenAdminUsers,
  onOpenAdminCoaches,
  onOpenAdminClients,
  onOpenAdminBookings,
    onOpenAdminPending,
    onOpenAdminFilteredBookings,
  onOpenAdminVerifications,
  onOpenAdminAuditLogs,
  onOpenAdminOperations,
  onOpenAdminHelp,
  onOpenCoachOperations,
  onOpenFindCoaches,
  onSignOut,
}) {
  const accountType = normalizeUserType(profile?.user_type || currentUser?.user_type || 'client');
  const displayName = profile?.full_name || currentUser?.full_name || currentUser?.email || 'FACT user';
  const resolvedDashboard = dashboard || buildDashboardState(accountType, {});
  const defaultTab = accountType === 'coach' ? 'pending' : 'upcoming';
  const [activeBookingTab, setActiveBookingTab] = useState(defaultTab);
  const tabs = accountType === 'coach' ? COACH_BOOKING_TABS : accountType === 'client' ? CLIENT_BOOKING_TABS : null;
  const tabBookings = tabs
    ? filterDashboardBookings(resolvedDashboard.bookings, activeBookingTab, accountType)
    : resolvedDashboard.bookings.slice(0, 8);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1600&q=80' }}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay}>
          <View style={styles.brandRow}>
            <BrandLogo />
            <Text style={styles.brandText}>FACT</Text>
          </View>

          <Text style={styles.title}>Welcome back, {displayName}.</Text>
        </View>
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.sectionHeaderCompact}>
          <Text style={styles.sectionEyebrow}>{resolvedDashboard.eyebrow}</Text>
          <Text style={styles.sectionTitle}>{resolvedDashboard.heading}</Text>
          <Text style={styles.sectionSubtitle}>{resolvedDashboard.subheading}</Text>
        </View>

        {accountType === 'coach' && resolvedDashboard.stats.find(s => s.label === 'Pending')?.value > 0 ? (
          <View style={styles.pendingAlertBanner}>
            <Text style={styles.pendingAlertText}>
              You have {resolvedDashboard.stats.find(s => s.label === 'Pending').value} new booking request{resolvedDashboard.stats.find(s => s.label === 'Pending').value === 1 ? '' : 's'} to review
            </Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          {resolvedDashboard.stats.map((item) => {
            const isAccountsCta = accountType === 'admin' && item.label === 'Accounts';
            const isCoachesCta = accountType === 'admin' && item.label === 'Coaches';
            const isClientsCta = accountType === 'admin' && item.label === 'Clients';
            const isBookingsCta = accountType === 'admin' && item.label === 'Bookings';

            if (isAccountsCta) {
              return (
                <Pressable
                  key={item.label}
                  onPress={onOpenAdminUsers}
                  style={({ pressed }) => [styles.statTile, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                </Pressable>
              );
            }

            if (isCoachesCta) {
              return (
                <Pressable
                  key={item.label}
                  onPress={onOpenAdminCoaches}
                  style={({ pressed }) => [styles.statTile, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                </Pressable>
              );
            }

            if (isClientsCta) {
              return (
                <Pressable
                  key={item.label}
                  onPress={onOpenAdminClients}
                  style={({ pressed }) => [styles.statTile, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                </Pressable>
              );
            }

            if (isBookingsCta) {
              return (
                <Pressable
                  key={item.label}
                  onPress={onOpenAdminBookings}
                  style={({ pressed }) => [styles.statTile, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                </Pressable>
              );
            }

            const isPendingCta = accountType === 'admin' && item.label === 'Pending';

            if (isPendingCta) {
              return (
                <Pressable
                  key={item.label}
                  onPress={onOpenAdminPending}
                  style={({ pressed }) => [styles.statTile, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                </Pressable>
              );
            }
            return (
              <View key={item.label} style={styles.statTile}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue}>{item.value}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.spotlightRow}>
          {resolvedDashboard.spotlight.map((item) => {
            const statusLabel = item.label.toLowerCase();
            const isStatusCta = accountType === 'admin' && ['pending', 'confirmed', 'completed', 'cancelled'].includes(statusLabel);
            if (isStatusCta) {
              return (
                <Pressable
                  key={item.label}
                  onPress={() => onOpenAdminFilteredBookings(statusLabel)}
                  style={({ pressed }) => [styles.spotlightCard, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.spotlightLabel}>{item.label}</Text>
                  <Text style={styles.spotlightValue}>{item.value}</Text>
                </Pressable>
              );
            }
            return (
              <View key={item.label} style={styles.spotlightCard}>
                <Text style={styles.spotlightLabel}>{item.label}</Text>
                <Text style={styles.spotlightValue}>{item.value}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHeaderCompact}>
          <Text style={styles.sectionEyebrow}>{resolvedDashboard.bookingsTitle}</Text>
          {dashboardLoading ? <Text style={styles.sectionSubtitle}>Refreshing native dashboard data...</Text> : null}
          {dashboardError ? <Text style={styles.errorText}>{dashboardError}</Text> : null}
        </View>

        {tabs ? (
          <View style={styles.bookingTabRow}>
            {tabs.map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveBookingTab(tab.key)}
                style={[styles.bookingTab, activeBookingTab === tab.key && styles.bookingTabActive]}
              >
                <Text style={[styles.bookingTabText, activeBookingTab === tab.key && styles.bookingTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {dashboardLoading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading your dashboard</Text>
          </View>
        ) : tabBookings.length > 0 ? (
          <View style={styles.bookingList}>
            {tabBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} accountType={accountType} />
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardCopy}>
              {tabs ? `No ${activeBookingTab} bookings.` : resolvedDashboard.emptyBookingsText}
            </Text>
          </View>
        )}

        <View style={styles.actionGroupSignedIn}>
          {accountType === 'admin' ? (
            <>
              <Pressable
                onPress={onOpenAdminVerifications}
                style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
              >
                <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Verifications</Text>
                <Text style={[styles.actionBody, styles.actionBodySecondary]}>Review and action coach verification requests in native admin operations.</Text>
              </Pressable>

              <Pressable
                onPress={onOpenAdminAuditLogs}
                style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
              >
                <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Audit Logs</Text>
                <Text style={[styles.actionBody, styles.actionBodySecondary]}>Open native operations to monitor recent admin actions and platform activity.</Text>
              </Pressable>

              <Pressable
                onPress={onOpenAdminOperations}
                style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
              >
                <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Operations</Text>
                <Text style={[styles.actionBody, styles.actionBodySecondary]}>Manage disputes, cases, and platform tasks from the in-app operations screen.</Text>
              </Pressable>

              <Pressable
                onPress={onOpenMessages}
                style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
              >
                <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Messages</Text>
                <Text style={[styles.actionBody, styles.actionBodySecondary]}>Open native direct messages without leaving the app.</Text>
              </Pressable>

              <Pressable
                onPress={onOpenAdminHelp}
                style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
              >
                <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Help</Text>
                <Text style={[styles.actionBody, styles.actionBodySecondary]}>Use native messages to contact support from your signed-in admin session.</Text>
              </Pressable>
            </>
          ) : null}

          {accountType === 'coach' ? (
            <Pressable
              onPress={onOpenCoachOperations}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Open coach operations</Text>
              <Text style={styles.actionBody}>Manage compliance details and live availability blocks inside the app.</Text>
            </Pressable>
          ) : null}

          {accountType === 'client' ? (
            <Pressable
              onPress={onOpenFindCoaches}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Find a coach</Text>
              <Text style={styles.actionBody}>Browse verified coaches, view profiles, and book a session without leaving the app.</Text>
            </Pressable>
          ) : null}

          {accountType !== 'admin' ? (
            <Pressable
              onPress={onOpenMessages}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Open native messages</Text>
              <Text style={styles.actionBody}>Browse booking conversations in the app instead of jumping out to the website.</Text>
            </Pressable>
          ) : null}

          {accountType !== 'admin' ? (
            <Pressable
              onPress={onOpenBookings}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionTitle}>Open native bookings</Text>
              <Text style={styles.actionBody}>Stay in the app for booking lists and booking detail.</Text>
            </Pressable>
          ) : null}

          {resolvedDashboard.primaryLink ? (
            <Pressable
              onPress={() => openHref(resolvedDashboard.primaryLink.href)}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
            >
              <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>{resolvedDashboard.primaryLink.label}</Text>
              <Text style={[styles.actionBody, styles.actionBodySecondary]}>Use the web dashboard only for the deeper tools that have not been migrated yet.</Text>
            </Pressable>
          ) : null}

          {resolvedDashboard.secondaryLink ? (
            <Pressable
              onPress={() => openHref(resolvedDashboard.secondaryLink.href)}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
            >
              <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>{resolvedDashboard.secondaryLink.label}</Text>
              <Text style={[styles.actionBody, styles.actionBodySecondary]}>Keep moving inside the product while the native experience expands.</Text>
            </Pressable>
          ) : null}

          {accountType !== 'admin' ? (
            <Pressable
              onPress={onRefresh}
              style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
            >
              <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Refresh dashboard</Text>
              <Text style={[styles.actionBody, styles.actionBodySecondary]}>Pull the latest stats and bookings from the live API.</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Sign out</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Clear the local session on this device.</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function LoginPickerScreen({ onBack, onSelectEmail, onSelectGoogle }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.signInHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.brandRowCompact}>
            <BrandLogo compact={true} />
            <Text style={styles.brandText}>FACT Mobile</Text>
          </View>
        </View>

        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Login to FACT</Text>
          <Text style={styles.signInSubtitle}>Choose your preferred login method to access your account.</Text>

          <Pressable
            onPress={onSelectGoogle}
            style={({ pressed }) => [styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 0, paddingVertical: 14, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
            <Text style={[styles.inputLabel, { marginBottom: 0, color: '#1e293b' }]}>Continue with Google</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
            <Text style={{ marginHorizontal: 12, color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
          </View>

          <Pressable
            onPress={onSelectEmail}
            style={({ pressed }) => [styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 0, paddingVertical: 14, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 16 }}>✉️</Text>
            <Text style={[styles.inputLabel, { marginBottom: 0, color: '#1e293b' }]}>Continue with Email</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SignInScreen({ email, password, errorMessage, submitting, onEmailChange, onPasswordChange, onBack, onSubmit }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.signInHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.brandRowCompact}>
            <BrandLogo compact={true} />
            <Text style={styles.brandText}>FACT Mobile</Text>
          </View>
        </View>

        <View style={styles.signInCard}>
          <Text style={styles.sectionEyebrow}>Sign In</Text>
          <Text style={styles.signInTitle}>Use your FACT account directly in the app</Text>
          <Text style={styles.signInSubtitle}>
            This removes the Safari handoff for email login and keeps the session inside FACT Mobile.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
              keyboardType="email-address"
              onChangeText={onEmailChange}
              placeholder="name@example.com"
              placeholderTextColor="#64748b"
              style={styles.input}
              textContentType="none"
              value={email}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
              onChangeText={onPasswordChange}
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              secureTextEntry={true}
              style={styles.input}
              textContentType="none"
              value={password}
            />
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            disabled={submitting}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || submitting) && styles.actionButtonPressed,
            ]}
          >
            {submitting ? <ActivityIndicator color="#08111f" /> : <Text style={styles.submitButtonText}>Sign In</Text>}
          </Pressable>

          <Pressable onPress={() => openHref('https://findacoachtoday.com/forgotpassword')} style={styles.secondaryLinkButton}>
            <Text style={styles.secondaryLinkText}>Forgot password?</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    scopes: ['email', 'profile', 'openid'],
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [view, setView] = useState('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [bookingsViewLoading, setBookingsViewLoading] = useState(false);
  const [bookingsViewError, setBookingsViewError] = useState('');
  const [bookingsViewItems, setBookingsViewItems] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingMessages, setBookingMessages] = useState([]);
  const [bookingMessagesLoading, setBookingMessagesLoading] = useState(false);
  const [bookingMessagesError, setBookingMessagesError] = useState('');
  const [messageDrafts, setMessageDrafts] = useState({});
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedDirectThread, setSelectedDirectThread] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [directMessagesLoading, setDirectMessagesLoading] = useState(false);
  const [directMessagesError, setDirectMessagesError] = useState('');
  const [recipientForAdmin, setRecipientForAdmin] = useState('client');
  const [messageConversations, setMessageConversations] = useState([]);
  const [messageConversationsLoading, setMessageConversationsLoading] = useState(false);
  const [messageConversationsError, setMessageConversationsError] = useState('');
  const [messageOriginView, setMessageOriginView] = useState('booking_detail');
  const [bookingActionLoading, setBookingActionLoading] = useState(false);
  const [bookingActionError, setBookingActionError] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [adminOpsLoading, setAdminOpsLoading] = useState(false);
  const [adminOpsError, setAdminOpsError] = useState('');
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersTotal, setAdminUsersTotal] = useState(0);
  const [adminCoachesLoading, setAdminCoachesLoading] = useState(false);
  const [adminCoachesError, setAdminCoachesError] = useState('');
  const [adminCoaches, setAdminCoaches] = useState([]);
  const [adminCoachesTotal, setAdminCoachesTotal] = useState(0);
  const [adminClientsLoading, setAdminClientsLoading] = useState(false);
  const [adminClientsError, setAdminClientsError] = useState('');
  const [adminClients, setAdminClients] = useState([]);
  const [adminClientsTotal, setAdminClientsTotal] = useState(0);
  const [adminBookingsLoading, setAdminBookingsLoading] = useState(false);
  const [adminBookingsError, setAdminBookingsError] = useState('');
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminBookingsTotal, setAdminBookingsTotal] = useState(0);
    const [adminPendingLoading, setAdminPendingLoading] = useState(false);
    const [adminPendingError, setAdminPendingError] = useState('');
    const [adminPending, setAdminPending] = useState([]);
    const [adminPendingTotal, setAdminPendingTotal] = useState(0);
  const [adminFilteredBookings, setAdminFilteredBookings] = useState([]);
  const [adminFilteredStatus, setAdminFilteredStatus] = useState('');
  const [adminFilteredLoading, setAdminFilteredLoading] = useState(false);
  const [adminFilteredError, setAdminFilteredError] = useState('');
  const [adminOpsOverview, setAdminOpsOverview] = useState(null);
  const [adminOpsWeekly, setAdminOpsWeekly] = useState(null);
  const [adminOpsCases, setAdminOpsCases] = useState([]);
  const [adminOpsDisputes, setAdminOpsDisputes] = useState([]);
  const [adminOpsExpiring, setAdminOpsExpiring] = useState([]);
  const [adminVerifications, setAdminVerifications] = useState([]);
  const [adminCaseFilter, setAdminCaseFilter] = useState('all');
  const [adminDisputeFilter, setAdminDisputeFilter] = useState('all');
  const [adminCaseLimit, setAdminCaseLimit] = useState(5);
  const [adminDisputeLimit, setAdminDisputeLimit] = useState(5);
  const [adminVerificationLimit, setAdminVerificationLimit] = useState(6);
  const [adminCaseTotal, setAdminCaseTotal] = useState(0);
  const [adminDisputeTotal, setAdminDisputeTotal] = useState(0);
  const [adminVerificationTotal, setAdminVerificationTotal] = useState(0);
  const [adminCaseDrafts, setAdminCaseDrafts] = useState({});
  const [adminDisputeDrafts, setAdminDisputeDrafts] = useState({});
  const [adminVerificationFilter, setAdminVerificationFilter] = useState('pending');
  const [adminVerificationNotes, setAdminVerificationNotes] = useState({});
  const [adminCaseSubmittingId, setAdminCaseSubmittingId] = useState(null);
  const [adminDisputeSubmittingId, setAdminDisputeSubmittingId] = useState(null);
  const [adminVerificationSubmittingId, setAdminVerificationSubmittingId] = useState(null);
  const [adminCaseError, setAdminCaseError] = useState('');
  const [adminDisputeError, setAdminDisputeError] = useState('');
  const [adminVerificationError, setAdminVerificationError] = useState('');
  const [adminCaseSuccess, setAdminCaseSuccess] = useState('');
  const [adminDisputeSuccess, setAdminDisputeSuccess] = useState('');
  const [adminVerificationSuccess, setAdminVerificationSuccess] = useState('');
  const [adminInviteEmail, setAdminInviteEmail] = useState('');
  const [adminInviteScope, setAdminInviteScope] = useState('support');
  const [adminInviteHours, setAdminInviteHours] = useState('72');
  const [adminInviteSubmitting, setAdminInviteSubmitting] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState('');
  const [adminOpsUsers, setAdminOpsUsers] = useState([]);
  const [adminOpsInvites, setAdminOpsInvites] = useState([]);
  const [adminOpsSnapshots, setAdminOpsSnapshots] = useState([]);
  const [adminOpsSnapshotsTotal, setAdminOpsSnapshotsTotal] = useState(0);
  const [adminOpsSignupAttempts, setAdminOpsSignupAttempts] = useState([]);
  const [adminOpsSignupTotal, setAdminOpsSignupTotal] = useState(0);
  const [adminOpsSignupLimit, setAdminOpsSignupLimit] = useState(10);
  const [adminRevokeSessionLoadingId, setAdminRevokeSessionLoadingId] = useState(null);
  const [adminRevokeInviteLoadingId, setAdminRevokeInviteLoadingId] = useState(null);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [adminAuditLogsLoading, setAdminAuditLogsLoading] = useState(false);
  const [adminAuditLogsError, setAdminAuditLogsError] = useState('');
  const [adminAuditAction, setAdminAuditAction] = useState('all');
  const [adminAuditTotal, setAdminAuditTotal] = useState(0);
  const [adminAuditLimit, setAdminAuditLimit] = useState(25);
  const [helpFaqs, setHelpFaqs] = useState([]);
  const [helpAllFaqs, setHelpAllFaqs] = useState([]);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState('');
  const [helpSearchTerm, setHelpSearchTerm] = useState('');
  const [helpCategory, setHelpCategory] = useState('all');
  const [helpExpandedIds, setHelpExpandedIds] = useState([]);
  const [helpEditorEntry, setHelpEditorEntry] = useState(null);
  const [helpEditorSaving, setHelpEditorSaving] = useState(false);
  const [helpEditorError, setHelpEditorError] = useState('');
  const [coachOpsLoading, setCoachOpsLoading] = useState(false);
  const [coachOpsError, setCoachOpsError] = useState('');
  const [coachProfileForm, setCoachProfileForm] = useState(buildCoachProfileForm(null));
  const [coachProfileSubmitting, setCoachProfileSubmitting] = useState(false);
  const [coachProfileError, setCoachProfileError] = useState('');
  const [coachComplianceForm, setCoachComplianceForm] = useState(buildCoachComplianceForm(null));
  const [coachComplianceSubmitting, setCoachComplianceSubmitting] = useState(false);
  const [coachComplianceError, setCoachComplianceError] = useState('');
  const [coachComplianceUploadSubmitting, setCoachComplianceUploadSubmitting] = useState(false);
  const [coachComplianceUploadError, setCoachComplianceUploadError] = useState('');
  const [coachAvailability, setCoachAvailability] = useState([]);
  const [coachAvailabilityForm, setCoachAvailabilityForm] = useState(buildAvailabilityForm());
  const [coachAvailabilitySubmitting, setCoachAvailabilitySubmitting] = useState(false);
  const [coachAvailabilityError, setCoachAvailabilityError] = useState('');
  const [coachRecurringAvailability, setCoachRecurringAvailability] = useState([]);
  const [coachRecurringForm, setCoachRecurringForm] = useState(buildRecurringAvailabilityForm());
  const [coachRecurringSubmitting, setCoachRecurringSubmitting] = useState(false);
  const [coachRecurringError, setCoachRecurringError] = useState('');

  // Find Coaches flow
  const [findCoachesItems, setFindCoachesItems] = useState([]);
  const [findCoachesLoading, setFindCoachesLoading] = useState(false);
  const [findCoachesError, setFindCoachesError] = useState('');
  const [findCoachesTotal, setFindCoachesTotal] = useState(0);
  const [findCoachesPage, setFindCoachesPage] = useState(0);
  const [findCoachesQuery, setFindCoachesQuery] = useState('');
  const [findCoachesServiceType, setFindCoachesServiceType] = useState('');
  const [selectedCoach, setSelectedCoach] = useState(null);
  // New Booking flow
  const [newBookingServiceType, setNewBookingServiceType] = useState('');
  const [newBookingDate, setNewBookingDate] = useState('');
  const [newBookingTime, setNewBookingTime] = useState('');
  const [newBookingLocationType, setNewBookingLocationType] = useState('online');
  const [newBookingAddress, setNewBookingAddress] = useState('');
  const [newBookingNotes, setNewBookingNotes] = useState('');
  const [newBookingSubmitting, setNewBookingSubmitting] = useState(false);
  const [newBookingError, setNewBookingError] = useState('');
  const [newBookingSuccess, setNewBookingSuccess] = useState('');

  const loadDashboard = async (nextUser, nextProfile) => {
    if (!nextUser?.id) {
      setDashboard(null);
      setDashboardError('');
      return;
    }

    const accountType = normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client');
    setDashboardLoading(true);
    setDashboardError('');

    try {
      if (accountType === 'admin') {
        const [userStats, bookingStats, recentBookings] = await Promise.all([
          mobileApi.getUsers({ stats: '1' }),
          mobileApi.getBookingStats(),
          mobileApi.getBookings({ view: 'admin_list', limit: 5, offset: 0, orderBy: '-created_at' }),
        ]);

        setDashboard(buildDashboardState(accountType, { userStats, bookingStats, recentBookings }));
        return;
      }

      const bookings = await mobileApi.getBookings({
        [accountType === 'coach' ? 'coach_id' : 'client_id']: nextUser.id,
        limit: 8,
        offset: 0,
        orderBy: accountType === 'coach' ? 'booking_date' : '-booking_date',
      });

      setDashboard(buildDashboardState(accountType, { bookings: Array.isArray(bookings) ? bookings : bookings?.data || [] }));
    } catch (error) {
      setDashboard(buildDashboardState(accountType, {}));
      setDashboardError(error?.message || 'Unable to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadBookingsView = async (nextUser, nextProfile) => {
    if (!nextUser?.id) {
      setBookingsViewItems([]);
      setBookingsViewError('');
      return;
    }

    const accountType = normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client');
    setBookingsViewLoading(true);
    setBookingsViewError('');

    try {
      const response = await mobileApi.getBookings(
        accountType === 'admin'
          ? {
              view: 'admin_list',
              include_archived: 1,
              include_total: 1,
              limit: 50,
              offset: 0,
              orderBy: '-created_at',
            }
          : {
              [accountType === 'coach' ? 'coach_id' : 'client_id']: nextUser.id,
              limit: 20,
              offset: 0,
              orderBy: '-booking_date',
            }
      );

      const rows = Array.isArray(response) ? response : response?.data || [];
      setBookingsViewItems(rows);
    } catch (error) {
      setBookingsViewItems([]);
      setBookingsViewError(error?.message || 'Unable to load bookings.');
    } finally {
      setBookingsViewLoading(false);
    }
  };

  const loadAdminUsers = async (nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminUsers([]);
      setAdminUsersTotal(0);
      setAdminUsersError('');
      return;
    }

    setAdminUsersLoading(true);
    setAdminUsersError('');

    try {
      const response = await mobileApi.getUsers({
        view: 'admin_list',
        include_total: 1,
        limit: 50,
        offset: 0,
        orderBy: '-updated_at',
      });
      const rows = Array.isArray(response) ? response : response?.data || [];
      const totalRows = Number(response?.total ?? rows.length ?? 0);
      setAdminUsers(rows);
      setAdminUsersTotal(Number.isFinite(totalRows) ? totalRows : rows.length);
    } catch (error) {
      setAdminUsers([]);
      setAdminUsersTotal(0);
      setAdminUsersError(error?.message || 'Unable to load registered users.');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const loadAdminCoaches = async (nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminCoaches([]);
      setAdminCoachesTotal(0);
      setAdminCoachesError('');
      return;
    }

    setAdminCoachesLoading(true);
    setAdminCoachesError('');

    try {
      const response = await mobileApi.getUsers({
        view: 'admin_list',
        type: 'coach',
        include_total: 1,
        limit: 50,
        offset: 0,
        orderBy: '-updated_at',
      });
      const rows = Array.isArray(response) ? response : response?.data || [];
      const totalRows = Number(response?.total ?? rows.length ?? 0);
      setAdminCoaches(rows);
      setAdminCoachesTotal(Number.isFinite(totalRows) ? totalRows : rows.length);
    } catch (error) {
      setAdminCoaches([]);
      setAdminCoachesTotal(0);
      setAdminCoachesError(error?.message || 'Unable to load coaches.');
    } finally {
      setAdminCoachesLoading(false);
    }
  };

  const loadAdminClients = async (nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminClients([]);
      setAdminClientsTotal(0);
      setAdminClientsError('');
      return;
    }

    setAdminClientsLoading(true);
    setAdminClientsError('');

    try {
      const response = await mobileApi.getUsers({
        view: 'admin_list',
        type: 'client',
        include_total: 1,
        limit: 50,
        offset: 0,
        orderBy: '-updated_at',
      });
      const rows = Array.isArray(response) ? response : response?.data || [];
      const totalRows = Number(response?.total ?? rows.length ?? 0);
      setAdminClients(rows);
      setAdminClientsTotal(Number.isFinite(totalRows) ? totalRows : rows.length);
    } catch (error) {
      setAdminClients([]);
      setAdminClientsTotal(0);
      setAdminClientsError(error?.message || 'Unable to load clients.');
    } finally {
      setAdminClientsLoading(false);
    }
  };

  const loadAdminBookings = async (nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminBookings([]);
      setAdminBookingsTotal(0);
      setAdminBookingsError('');
      return;
    }

  setAdminPending([]);
  setAdminPendingTotal(0);
  setAdminPendingError('');
    setAdminBookingsLoading(true);
    setAdminBookingsError('');

    try {
      const response = await mobileApi.getBookings({
        view: 'admin_list',
        limit: 50,
        offset: 0,
        orderBy: '-created_at',
      });
      let rows = Array.isArray(response) ? response : response?.data || [];
      let totalRows = Number(response?.total ?? rows.length ?? 0);

      setAdminBookings(rows);
      setAdminBookingsTotal(Number.isFinite(totalRows) ? totalRows : rows.length);
    } catch (error) {
      setAdminBookings([]);
      setAdminBookingsTotal(0);
      setAdminBookingsError(error?.message || 'Unable to load bookings.');
    } finally {
      setAdminBookingsLoading(false);
    }
  };

  const loadAdminPending = async (nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminPending([]);
      setAdminPendingTotal(0);
      setAdminPendingError('');
      return;
    }

    setAdminPendingLoading(true);
    setAdminPendingError('');

    try {
      const response = await mobileApi.getBookings({
        view: 'admin_list',
        status: 'pending',
        limit: 50,
        offset: 0,
        orderBy: '-created_at',
      });
      let rows = Array.isArray(response) ? response : response?.data || [];
      let totalRows = Number(response?.total ?? rows.length ?? 0);

      setAdminPending(rows);
      setAdminPendingTotal(Number.isFinite(totalRows) ? totalRows : rows.length);
    } catch (error) {
      setAdminPending([]);
      setAdminPendingTotal(0);
      setAdminPendingError(error?.message || 'Unable to load pending bookings.');
    } finally {
      setAdminPendingLoading(false);
    }
  };
  const loadBookingMessages = async (booking = selectedBooking, nextUser = currentUser) => {
    if (!booking?.id || !nextUser?.id) {
      setBookingMessages([]);
      setBookingMessagesError('');
      return;
    }

    setBookingMessagesLoading(true);
    setBookingMessagesError('');

    try {
      const response = await mobileApi.getMessages(booking.id);
      const nextMessages = Array.isArray(response) ? response : [];
      setBookingMessages(nextMessages);

      const unreadMessages = nextMessages.filter((message) => message.receiver_id === nextUser.id && !message.is_read);
      if (unreadMessages.length > 0) {
        setBookingMessages((previousMessages) => previousMessages.map((message) => (
          unreadMessages.some((unread) => unread.id === message.id)
            ? { ...message, is_read: true }
            : message
        )));

        await Promise.allSettled(unreadMessages.map((message) => mobileApi.markMessageRead(message.id)));
      }
    } catch (error) {
      setBookingMessagesError(error?.message || 'Unable to load booking messages.');
    } finally {
      setBookingMessagesLoading(false);
    }
  };

  const loadDirectMessages = async (thread = selectedDirectThread, nextUser = currentUser) => {
    if (!thread?.direct_user_id || !nextUser?.id) {
      setDirectMessages([]);
      setDirectMessagesError('');
      return;
    }

    setDirectMessagesLoading(true);
    setDirectMessagesError('');

    try {
      const response = await mobileApi.getDirectMessages(thread.direct_user_id);
      const nextMessages = Array.isArray(response) ? response : [];
      setDirectMessages(nextMessages);

      const unreadMessages = nextMessages.filter((message) => message.receiver_id === nextUser.id && !message.is_read);
      if (unreadMessages.length > 0) {
        setDirectMessages((previousMessages) => previousMessages.map((message) => (
          unreadMessages.some((unread) => unread.id === message.id)
            ? { ...message, is_read: true }
            : message
        )));

        await Promise.allSettled(unreadMessages.map((message) => mobileApi.markMessageRead(message.id)));
      }
    } catch (error) {
      setDirectMessagesError(error?.message || 'Unable to load direct messages.');
    } finally {
      setDirectMessagesLoading(false);
    }
  };

  const loadMessageConversations = async (nextUser = currentUser, nextProfile = profile) => {
    if (!nextUser?.id) {
      setMessageConversations([]);
      setMessageConversationsError('');
      return;
    }

    const accountType = normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client');
    setMessageConversationsLoading(true);
    setMessageConversationsError('');

    try {
      const [response, directThreadsResponse] = await Promise.all([
        mobileApi.getBookings(
        accountType === 'admin'
          ? { view: 'admin_list', limit: 20, offset: 0, orderBy: '-updated_at' }
          : {
              [accountType === 'coach' ? 'coach_id' : 'client_id']: nextUser.id,
              limit: 20,
              offset: 0,
              orderBy: '-updated_at',
            }
        ),
        mobileApi.getDirectThreads(),
      ]);

      const bookings = Array.isArray(response) ? response : response?.data || [];
      const messageResults = await Promise.allSettled(
        bookings.map(async (booking) => {
          const thread = await mobileApi.getMessages(booking.id);
          const messages = Array.isArray(thread) ? thread : [];
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

          return {
            type: 'booking',
            booking_id: booking.id,
            booking,
            other_user_name: getConversationLabel(booking, nextUser),
            last_message: lastMessage?.content || 'Start a conversation',
            last_message_date: lastMessage?.created_date || booking.updated_at || booking.created_at,
            is_read: lastMessage ? (lastMessage.sender_id === nextUser.id || lastMessage.is_read) : true,
          };
        })
      );

      const conversations = messageResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
        ;

      const directThreads = Array.isArray(directThreadsResponse) ? directThreadsResponse : [];
      const directUsers = await Promise.allSettled(
        directThreads.map(async (thread) => {
          const user = await mobileApi.getUser(thread.other_user_id);
          return {
            ...thread,
            other_user_name: normalizeUserType(user?.user_type || 'client') === 'admin'
              ? 'Support Team'
              : (user?.full_name || thread.other_user_id || 'Support Team'),
            other_user_type: user?.user_type || 'client',
          };
        })
      );

      const directConversations = directUsers
        .filter((result) => result.status === 'fulfilled')
        .map((result) => {
          const thread = result.value;
          return {
            type: 'direct',
            direct_user_id: thread.other_user_id,
            other_user_name: thread.other_user_name,
            other_user_type: thread.other_user_type,
            last_message: thread.content || 'Start a conversation',
            last_message_date: thread.created_date,
            is_read: thread.sender_id === nextUser.id || thread.is_read,
          };
        });

      conversations.push(...directConversations);
      conversations.sort((left, right) => new Date(right.last_message_date) - new Date(left.last_message_date));

      setMessageConversations(conversations);
    } catch (error) {
      setMessageConversations([]);
      setMessageConversationsError(error?.message || 'Unable to load messages inbox.');
    } finally {
      setMessageConversationsLoading(false);
    }
  };

  const loadAdminOperations = async (nextUser = currentUser, nextProfile = profile, options = {}) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminOpsOverview(null);
      setAdminOpsWeekly(null);
      setAdminOpsCases([]);
      setAdminOpsDisputes([]);
      setAdminOpsExpiring([]);
      setAdminVerifications([]);
      setAdminCaseTotal(0);
      setAdminDisputeTotal(0);
      setAdminVerificationTotal(0);
      setAdminCaseError('');
      setAdminDisputeError('');
      setAdminVerificationError('');
      setAdminOpsError('');
      setAdminOpsUsers([]);
      setAdminOpsInvites([]);
      setAdminOpsSnapshots([]);
      setAdminOpsSnapshotsTotal(0);
      setAdminOpsSignupAttempts([]);
      setAdminOpsSignupTotal(0);
      return;
    }

    setAdminOpsLoading(true);
    setAdminOpsError('');
    setAdminCaseError('');
    setAdminDisputeError('');
    setAdminVerificationError('');

    try {
      const selectedVerificationFilter = String(options.verificationFilter ?? adminVerificationFilter ?? 'pending');
      const selectedCaseFilter = String(options.caseFilter ?? adminCaseFilter ?? 'all');
      const selectedDisputeFilter = String(options.disputeFilter ?? adminDisputeFilter ?? 'all');
      const selectedCaseLimit = Number(options.caseLimit ?? adminCaseLimit ?? 5);
      const selectedDisputeLimit = Number(options.disputeLimit ?? adminDisputeLimit ?? 5);
      const selectedVerificationLimit = Number(options.verificationLimit ?? adminVerificationLimit ?? 6);
      const [overview, weekly, casesResponse, disputesResponse, expiringResponse, verificationsResponse] = await Promise.all([
        mobileApi.getAdminOpsOverview(),
        mobileApi.getWeeklyOpsReport(),
        mobileApi.listAdminCases({ include_total: 1, limit: selectedCaseLimit, offset: 0, ...(selectedCaseFilter !== 'all' ? { status: selectedCaseFilter } : {}) }),
        mobileApi.listBookingDisputes({ include_total: 1, limit: selectedDisputeLimit, offset: 0, ...(selectedDisputeFilter !== 'all' ? { status: selectedDisputeFilter } : {}) }),
        mobileApi.listComplianceExpiring({ include_total: 1, limit: 5, offset: 0, days: 30 }),
        mobileApi.getAdminVerifications({ status: selectedVerificationFilter, include_total: 1, limit: selectedVerificationLimit, offset: 0 }),
      ]);

      setAdminOpsOverview(overview || null);
      setAdminOpsWeekly(weekly || null);
      const caseRows = casesResponse?.data || [];
      const disputeRows = disputesResponse?.data || [];
      setAdminOpsCases(caseRows);
      setAdminOpsDisputes(disputeRows);
      setAdminCaseTotal(Number(casesResponse?.total || caseRows.length || 0));
      setAdminDisputeTotal(Number(disputesResponse?.total || disputeRows.length || 0));
      setAdminOpsExpiring(expiringResponse?.data || []);
      const verificationRows = verificationsResponse?.data || [];
      setAdminVerifications(verificationRows);
      setAdminVerificationTotal(Number(verificationsResponse?.total || verificationRows.length || 0));
      setAdminCaseDrafts((previousDrafts) => {
        const nextDrafts = { ...previousDrafts };
        caseRows.forEach((item) => {
          nextDrafts[item.id] = {
            ...(nextDrafts[item.id] || buildAdminCaseDraft(item)),
            status: nextDrafts[item.id]?.status ?? item.status ?? 'open',
            priority: nextDrafts[item.id]?.priority ?? item.priority ?? 'normal',
            description: nextDrafts[item.id]?.description ?? item.description ?? '',
          };
        });
        return nextDrafts;
      });
      setAdminDisputeDrafts((previousDrafts) => {
        const nextDrafts = { ...previousDrafts };
        disputeRows.forEach((item) => {
          nextDrafts[item.id] = {
            ...(nextDrafts[item.id] || buildAdminDisputeDraft(item)),
            status: nextDrafts[item.id]?.status ?? item.status ?? 'open',
            decision: nextDrafts[item.id]?.decision ?? item.decision ?? 'other',
            resolution_notes: nextDrafts[item.id]?.resolution_notes ?? item.resolution_notes ?? '',
            refund_amount: nextDrafts[item.id]?.refund_amount ?? (item.refund_amount === null || item.refund_amount === undefined ? '' : String(item.refund_amount)),
          };
        });
        return nextDrafts;
      });
      setAdminVerificationNotes((previousNotes) => {
        const nextNotes = { ...previousNotes };
        verificationRows.forEach((item) => {
          nextNotes[item.id] = item.verification_notes || '';
        });
        return nextNotes;
      });

      // Supplementary data — failures are tolerated
      const [usersResult, invitesResult, snapshotsResult, signupResult] = await Promise.allSettled([
        mobileApi.getAdminUsersOps({ limit: 50, offset: 0 }),
        mobileApi.listAdminInvites({ include_total: 1, limit: 20, offset: 0 }),
        mobileApi.listDeletedUserSnapshots({ include_total: 1, limit: 10, offset: 0 }),
        mobileApi.listAuthLogs({ event_type: 'signup', include_total: 1, limit: 10, offset: 0 }),
      ]);
      setAdminOpsUsers(usersResult.status === 'fulfilled' ? (usersResult.value?.data || []) : []);
      setAdminOpsInvites(invitesResult.status === 'fulfilled' ? (invitesResult.value?.data || []) : []);
      setAdminOpsSnapshots(snapshotsResult.status === 'fulfilled' ? (snapshotsResult.value?.data || []) : []);
      setAdminOpsSnapshotsTotal(snapshotsResult.status === 'fulfilled' ? Number(snapshotsResult.value?.total || 0) : 0);
      setAdminOpsSignupAttempts(signupResult.status === 'fulfilled' ? (signupResult.value?.data || []) : []);
      setAdminOpsSignupTotal(signupResult.status === 'fulfilled' ? Number(signupResult.value?.total || 0) : 0);
    } catch (error) {
      setAdminOpsError(error?.message || 'Unable to load admin operations.');
    } finally {
      setAdminOpsLoading(false);
    }
  };

  const handleVerificationNoteChange = (coachId, value) => {
    setAdminVerificationNotes((previousNotes) => ({
      ...previousNotes,
      [coachId]: value,
    }));
  };

  const handleAdminCaseDraftChange = (caseId, field, value) => {
    setAdminCaseDrafts((previousDrafts) => ({
      ...previousDrafts,
      [caseId]: {
        ...(previousDrafts[caseId] || buildAdminCaseDraft()),
        [field]: value,
      },
    }));
    setAdminCaseSuccess('');
  };

  const handleAdminDisputeDraftChange = (disputeId, field, value) => {
    setAdminDisputeDrafts((previousDrafts) => ({
      ...previousDrafts,
      [disputeId]: {
        ...(previousDrafts[disputeId] || buildAdminDisputeDraft()),
        [field]: value,
      },
    }));
    setAdminDisputeSuccess('');
  };

  const handleSaveAdminCase = async (item, override = {}) => {
    if (!item?.id) {
      return;
    }

    const draft = adminCaseDrafts[item.id] || buildAdminCaseDraft(item);
    setAdminCaseSubmittingId(item.id);
    setAdminCaseError('');
    setAdminCaseSuccess('');

    try {
      const response = await mobileApi.updateAdminCase(item.id, {
        status: override.status || draft.status,
        priority: override.priority || draft.priority,
        description: override.description !== undefined ? override.description : draft.description,
        ...(override.owner_admin_id !== undefined ? { owner_admin_id: override.owner_admin_id } : {}),
      });
      const nextData = response?.data || response || {};

      setAdminOpsCases((previousRows) => previousRows.map((row) => (
        row.id === item.id ? { ...row, ...nextData } : row
      )));
      setAdminCaseDrafts((previousDrafts) => ({
        ...previousDrafts,
        [item.id]: buildAdminCaseDraft({ ...item, ...nextData }),
      }));
      setAdminCaseSuccess(override.owner_admin_id ? 'Case assigned to you.' : override.status === 'resolved' ? 'Case resolved.' : 'Case saved.');
      await loadAdminOperations(currentUser, profile);
    } catch (error) {
      setAdminCaseError(error?.message || 'Unable to update case.');
    } finally {
      setAdminCaseSubmittingId(null);
    }
  };

  const handleAssignAdminCaseToCurrentAdmin = async (item) => {
    if (!currentUser?.id) {
      return;
    }
    await handleSaveAdminCase(item, { owner_admin_id: currentUser.id });
  };

  const handleSaveBookingDispute = async (item, override = {}) => {
    if (!item?.id) {
      return;
    }

    const draft = adminDisputeDrafts[item.id] || buildAdminDisputeDraft(item);
    const refundAmountText = String(override.refund_amount ?? draft.refund_amount ?? '').trim();
    setAdminDisputeSubmittingId(item.id);
    setAdminDisputeError('');
    setAdminDisputeSuccess('');

    try {
      const response = await mobileApi.updateBookingDispute(item.id, {
        status: override.status || draft.status,
        decision: override.decision || draft.decision,
        resolution_notes: override.resolution_notes !== undefined ? override.resolution_notes : draft.resolution_notes,
        ...(override.assigned_admin_id !== undefined ? { assigned_admin_id: override.assigned_admin_id } : {}),
        ...(refundAmountText ? { refund_amount: Number(refundAmountText) } : {}),
      });
      const nextData = response?.data || response || {};

      setAdminOpsDisputes((previousRows) => previousRows.map((row) => (
        row.id === item.id ? { ...row, ...nextData } : row
      )));
      setAdminDisputeDrafts((previousDrafts) => ({
        ...previousDrafts,
        [item.id]: buildAdminDisputeDraft({ ...item, ...nextData }),
      }));
      setAdminDisputeSuccess(override.assigned_admin_id ? 'Dispute assigned to you.' : override.status === 'resolved' ? 'Dispute resolved.' : 'Dispute saved.');
      await loadAdminOperations(currentUser, profile);
    } catch (error) {
      setAdminDisputeError(error?.message || 'Unable to update dispute.');
    } finally {
      setAdminDisputeSubmittingId(null);
    }
  };

  const handleAssignBookingDisputeToCurrentAdmin = async (item) => {
    if (!currentUser?.id) {
      return;
    }
    await handleSaveBookingDispute(item, { assigned_admin_id: currentUser.id });
  };

  const handleUpdateVerification = async (coach, nextStatus) => {
    if (!coach?.id) {
      return;
    }

    setAdminVerificationSubmittingId(coach.id);
    setAdminVerificationError('');
    setAdminVerificationSuccess('');

    const noteDraft = String(adminVerificationNotes[coach.id] ?? coach.verification_notes ?? '').trim();
    const payload = {
      qualification_status: nextStatus,
      verification_notes: noteDraft,
      ...(coach.has_background_check ? { background_check_status: nextStatus } : {}),
    };

    try {
      const updated = await mobileApi.updateAdminVerification(coach.id, payload);
      const nextData = updated?.data || updated || {};

      setAdminVerifications((previousRows) => previousRows.map((row) => (
        row.id === coach.id ? { ...row, ...nextData } : row
      )));
      setAdminVerificationNotes((previousNotes) => ({
        ...previousNotes,
        [coach.id]: noteDraft,
      }));
      setAdminVerificationSuccess(`Verification marked ${formatStatusLabel(nextStatus)}.`);
      await loadAdminOperations(currentUser, profile);
    } catch (error) {
      setAdminVerificationError(error?.message || 'Unable to update verification.');
    } finally {
      setAdminVerificationSubmittingId(null);
    }
  };

  const loadCoachOperations = async (nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'coach' || !nextUser?.id) {
      setCoachOpsError('');
      setCoachAvailability([]);
      setCoachRecurringAvailability([]);
      return;
    }

    setCoachOpsLoading(true);
    setCoachOpsError('');

    try {
      const [nextCoachProfile, availabilityResponse, recurringResponse] = await Promise.all([
        getCurrentProfile(),
        mobileApi.getCoachAvailability({ coach_id: nextUser.id }),
        mobileApi.getCoachRecurringAvailability({ coach_id: nextUser.id }),
      ]);

      const availabilityItems = Array.isArray(availabilityResponse) ? availabilityResponse : [];
      const recurringItems = Array.isArray(recurringResponse) ? recurringResponse : [];
      setProfile(nextCoachProfile);
      setCoachProfileForm(buildCoachProfileForm(nextCoachProfile));
      setCoachComplianceForm(buildCoachComplianceForm(nextCoachProfile));
      setCoachAvailability(availabilityItems);
      setCoachRecurringAvailability(recurringItems);
      setCoachProfileError('');
      setCoachAvailabilityError('');
      setCoachRecurringError('');
      setCoachComplianceError('');
      setCoachComplianceUploadError('');
      setCoachAvailabilityForm(buildAvailabilityForm());
      setCoachRecurringForm(buildRecurringAvailabilityForm());
    } catch (error) {
      setCoachAvailability([]);
      setCoachRecurringAvailability([]);
      setCoachOpsError(error?.message || 'Unable to load coach operations.');
    } finally {
      setCoachOpsLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android' && GOOGLE_ANDROID_CLIENT_ID) {
      GoogleSignin.configure({
        androidClientId: GOOGLE_ANDROID_CLIENT_ID,
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        await mobileAuth.init();
        if (!active) return;
        const storedUser = mobileAuth.currentUser;
        setCurrentUser(storedUser);
        setView(storedUser ? 'account' : 'home');

        if (storedUser?.id) {
          setProfileLoading(true);
          try {
            const nextProfile = await getCurrentProfile();
            if (active) {
              setProfile(nextProfile);
              await loadDashboard(storedUser, nextProfile);
            }
          } catch {
            if (active) setProfile(null);
          } finally {
            if (active) setProfileLoading(false);
          }
        } else if (active) {
          setDashboard(null);
        }
      } finally {
        if (active) setBootstrapping(false);
      }
    };

    hydrate();

    const unsubscribe = mobileAuth.onAuthStateChange((nextUser) => {
      if (!active) return;
      setCurrentUser(nextUser);
      setView(nextUser ? 'account' : 'home');
      if (!nextUser) {
        setProfile(null);
        setDashboard(null);
        setDashboardError('');
        setBookingsViewItems([]);
        setBookingsViewError('');
        setSelectedBooking(null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (view !== 'booking_messages' || !selectedBooking?.id || !currentUser?.id) {
      return undefined;
    }

    let active = true;

    const refreshMessages = async () => {
      if (!active) return;
      await loadBookingMessages(selectedBooking, currentUser);
    };

    refreshMessages();
    const intervalId = setInterval(refreshMessages, 15000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [view, selectedBooking?.id, currentUser?.id]);

  useEffect(() => {
    if (view !== 'direct_messages' || !selectedDirectThread?.direct_user_id || !currentUser?.id) {
      return undefined;
    }

    let active = true;

    const refreshMessages = async () => {
      if (!active) return;
      await loadDirectMessages(selectedDirectThread, currentUser);
    };

    refreshMessages();
    const intervalId = setInterval(refreshMessages, 15000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [view, selectedDirectThread?.direct_user_id, currentUser?.id]);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      handleGoogleAuthSuccess(authentication?.accessToken);
    } else if (googleResponse?.type === 'error') {
      setErrorMessage('Google sign-in failed. Please try again.');
      setSubmitting(false);
    }
  }, [googleResponse]);

  const handleGoogleAuthSuccess = async (accessToken) => {
    if (!accessToken) return;
    setErrorMessage('');
    setSubmitting(true);
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) throw new Error('Failed to get user info from Google.');
      const googleUser = await userInfoRes.json();
      const signedInUser = await mobileApi.createUser({
        email: googleUser.email,
        full_name: googleUser.name || '',
        avatar_url: googleUser.picture || null,
      });
      if (!signedInUser?.id) throw new Error(signedInUser?.error || 'Google sign-in failed.');
      await mobileAuth.setCurrentUser({
        id: signedInUser.id,
        email: signedInUser.email,
        full_name: signedInUser.full_name,
        user_type: signedInUser.user_type,
        role: signedInUser.role,
        token: signedInUser.token,
      });
      setCurrentUser(signedInUser);
      setView('account');
      setProfileLoading(true);
      try {
        const nextProfile = await getCurrentProfile();
        setProfile(nextProfile);
        await loadDashboard(signedInUser, nextProfile);
      } finally {
        setProfileLoading(false);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAndroidGoogleSignIn = async () => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      // v13 returns response.data.user; v14 may return response.user — handle both
      const googleUser = response.data?.user ?? response.user;
      const signedInUser = await mobileApi.createUser({
        email: googleUser.email,
        full_name: googleUser.name || '',
        avatar_url: googleUser.photo || null,
      });
      if (!signedInUser?.id) throw new Error(signedInUser?.error || 'Google sign-in failed.');
      await mobileAuth.setCurrentUser({
        id: signedInUser.id,
        email: signedInUser.email,
        full_name: signedInUser.full_name,
        user_type: signedInUser.user_type,
        role: signedInUser.role,
        token: signedInUser.token,
      });
      setCurrentUser(signedInUser);
      setView('account');
      setProfileLoading(true);
      try {
        const nextProfile = await getCurrentProfile();
        setProfile(nextProfile);
        await loadDashboard(signedInUser, nextProfile);
      } finally {
        setProfileLoading(false);
      }
    } catch (error) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        setErrorMessage(error?.message || 'Unable to sign in with Google.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'android') {
      await handleAndroidGoogleSignIn();
      return;
    }
    setErrorMessage('');
    setSubmitting(true);
    setView('login_picker');
    await googlePromptAsync();
  };

  const handleSignIn = async () => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      const signedInUser = await signInWithEmail(email, password);
      setCurrentUser(signedInUser);
      setView('account');
      setPassword('');
      setProfileLoading(true);
      try {
        const nextProfile = await getCurrentProfile();
        setProfile(nextProfile);
        await loadDashboard(signedInUser, nextProfile);
      } finally {
        setProfileLoading(false);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setEmail('');
    setPassword('');
    setErrorMessage('');
    setProfile(null);
    setCurrentUser(null);
    setDashboard(null);
    setDashboardError('');
    setAdminOpsOverview(null);
    setAdminOpsWeekly(null);
    setAdminUsers([]);
    setAdminUsersTotal(0);
    setAdminUsersError('');
    setAdminCoaches([]);
    setAdminCoachesTotal(0);
    setAdminCoachesError('');
    setAdminClients([]);
    setAdminClientsTotal(0);
    setAdminClientsError('');
    setAdminBookings([]);
    setAdminBookingsTotal(0);
    setAdminBookingsError('');
    setAdminOpsCases([]);
    setAdminOpsDisputes([]);
    setAdminOpsExpiring([]);
    setAdminVerifications([]);
    setAdminCaseFilter('all');
    setAdminDisputeFilter('all');
    setAdminCaseLimit(5);
    setAdminDisputeLimit(5);
    setAdminVerificationLimit(6);
    setAdminCaseTotal(0);
    setAdminDisputeTotal(0);
    setAdminVerificationTotal(0);
    setAdminCaseDrafts({});
    setAdminDisputeDrafts({});
    setAdminVerificationNotes({});
    setAdminCaseError('');
    setAdminDisputeError('');
    setAdminVerificationError('');
    setAdminCaseSuccess('');
    setAdminDisputeSuccess('');
    setAdminVerificationSuccess('');
    setAdminCaseSubmittingId(null);
    setAdminDisputeSubmittingId(null);
    setAdminVerificationSubmittingId(null);
    setAdminOpsError('');
    setBookingsViewItems([]);
    setBookingsViewError('');
    setSelectedBooking(null);
    setSelectedDirectThread(null);
    setDirectMessages([]);
    setDirectMessagesError('');
    setBookingMessages([]);
    setBookingMessagesError('');
    setMessageConversations([]);
    setMessageConversationsError('');
    setMessageDrafts({});
    setRecipientForAdmin('client');
    setAdminInviteEmail('');
    setAdminInviteScope('support');
    setAdminInviteHours('72');
    setAdminInviteError('');
    setCoachOpsError('');
    setCoachProfileError('');
    setCoachProfileForm(buildCoachProfileForm(null));
    setCoachComplianceError('');
    setCoachComplianceForm(buildCoachComplianceForm(null));
    setCoachComplianceUploadError('');
    setCoachAvailabilityError('');
    setCoachAvailability([]);
    setCoachAvailabilityForm(buildAvailabilityForm());
    setCoachRecurringError('');
    setCoachRecurringAvailability([]);
    setCoachRecurringForm(buildRecurringAvailabilityForm());
    setView('home');
  };

  const handleCoachProfileChange = (field, value) => {
    setCoachProfileForm((previousForm) => ({
      ...previousForm,
      [field]: value,
    }));
  };

  const handleCoachProfileToggle = (field, value) => {
    setCoachProfileForm((previousForm) => {
      const currentValues = Array.isArray(previousForm[field]) ? previousForm[field] : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...previousForm,
        [field]: nextValues,
      };
    });
  };

  const handleSaveCoachProfile = async () => {
    if (!currentUser?.id) {
      return;
    }

    const safeCountry = String(coachProfileForm.country || '').trim();
    const safeCity = String(coachProfileForm.city || '').trim();
    const safeRate = Number(coachProfileForm.hourly_rate || 0);
    const clip1 = normalizeVideoUrl(coachProfileForm.video_clip_1);
    const clip2 = normalizeVideoUrl(coachProfileForm.video_clip_2);
    const clip3 = normalizeVideoUrl(coachProfileForm.video_clip_3);

    if (!safeCountry || !safeCity) {
      setCoachProfileError('Country and city are required for coach profiles.');
      return;
    }

    if (!Number.isFinite(safeRate) || safeRate <= 0) {
      setCoachProfileError('Hourly rate must be a valid number greater than zero.');
      return;
    }

    if (!clip1.ok || !clip2.ok || !clip3.ok) {
      setCoachProfileError(clip1.error || clip2.error || clip3.error || 'One or more video links are invalid.');
      return;
    }

    setCoachProfileSubmitting(true);
    setCoachProfileError('');

    try {
      const updated = await mobileApi.updateUser(currentUser.id, {
        full_name: coachProfileForm.full_name,
        phone: coachProfileForm.phone || null,
        location: coachProfileForm.location || null,
        country: safeCountry,
        city: safeCity,
        bio: coachProfileForm.bio || null,
        video_clip_1: clip1.value,
        video_clip_2: clip2.value,
        video_clip_3: clip3.value,
        coach_profile: {
          hourly_rate: safeRate,
          services_offered: coachProfileForm.services_offered,
          age_groups: coachProfileForm.age_groups,
        },
      });

      const mergedProfile = {
        ...(profile || {}),
        ...(updated || {}),
      };
      setProfile(mergedProfile);
      setCoachProfileForm(buildCoachProfileForm(mergedProfile));
      await loadDashboard(currentUser, mergedProfile);
    } catch (error) {
      setCoachProfileError(error?.message || 'Unable to update coach profile.');
    } finally {
      setCoachProfileSubmitting(false);
    }
  };

  const handleComplianceChange = (field, value) => {
    setCoachComplianceForm((previousForm) => {
      if (field === 'has_background_check' && value === false) {
        return {
          ...previousForm,
          has_background_check: false,
          background_check_type: '',
          background_check_expires_at: '',
        };
      }

      return {
        ...previousForm,
        [field]: value,
      };
    });
  };

  const handleAvailabilityFormChange = (field, value) => {
    setCoachAvailabilityForm((previousForm) => ({
      ...previousForm,
      [field]: value,
    }));
  };

  const handleSaveCompliance = async () => {
    if (!currentUser?.id) {
      return;
    }

    setCoachComplianceSubmitting(true);
    setCoachComplianceError('');

    try {
      const updated = await mobileApi.updateCompliance({
        qualification_type: coachComplianceForm.qualification_type,
        qualification_file_url: coachComplianceForm.qualification_file_url || null,
        has_background_check: coachComplianceForm.has_background_check,
        background_check_type: coachComplianceForm.has_background_check ? coachComplianceForm.background_check_type : null,
        background_check_file_url: coachComplianceForm.has_background_check
          ? (coachComplianceForm.background_check_file_url || null)
          : null,
        background_check_expires_at: coachComplianceForm.has_background_check
          ? (coachComplianceForm.background_check_expires_at || null)
          : null,
      });

      const mergedProfile = {
        ...(profile || {}),
        ...(updated?.data || updated || {}),
      };
      setProfile(mergedProfile);
      setCoachComplianceForm(buildCoachComplianceForm(mergedProfile));
    } catch (error) {
      setCoachComplianceError(error?.message || 'Unable to update compliance.');
    } finally {
      setCoachComplianceSubmitting(false);
    }
  };

  const handleUploadComplianceDocument = async (type) => {
    if (!currentUser?.id) {
      return;
    }

    setCoachComplianceUploadSubmitting(true);
    setCoachComplianceUploadError('');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ['application/pdf', 'image/jpeg', 'image/png'],
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const selected = result.assets[0];
      const uploadedUrl = await uploadComplianceAsset(selected, type === 'qualification' ? 'qualification' : 'background_check');

      setCoachComplianceForm((previousForm) => {
        if (type === 'qualification') {
          return {
            ...previousForm,
            qualification_file_url: uploadedUrl,
          };
        }

        return {
          ...previousForm,
          has_background_check: true,
          background_check_file_url: uploadedUrl,
        };
      });
    } catch (error) {
      setCoachComplianceUploadError(error?.message || 'Unable to upload document.');
    } finally {
      setCoachComplianceUploadSubmitting(false);
    }
  };

  const handleSaveAvailability = async () => {
    if (!currentUser?.id) {
      return;
    }

    const startDateTime = buildIsoDateTime(coachAvailabilityForm.startDate, coachAvailabilityForm.startTime);
    const endDateTime = buildIsoDateTime(coachAvailabilityForm.endDate, coachAvailabilityForm.endTime);
    if (!startDateTime || !endDateTime) {
      setCoachAvailabilityError('Enter valid start and end values in the format YYYY-MM-DD and HH:MM.');
      return;
    }

    if (new Date(startDateTime).getTime() >= new Date(endDateTime).getTime()) {
      setCoachAvailabilityError('End time must be after the start time.');
      return;
    }

    setCoachAvailabilitySubmitting(true);
    setCoachAvailabilityError('');

    const payload = {
      coach_id: currentUser.id,
      start_date: startDateTime,
      end_date: endDateTime,
      is_available: coachAvailabilityForm.isAvailable,
      location_override: coachAvailabilityForm.locationOverride,
      notes: coachAvailabilityForm.notes,
    };

    try {
      const savedRecord = coachAvailabilityForm.id
        ? await mobileApi.updateCoachAvailability(coachAvailabilityForm.id, payload)
        : await mobileApi.createCoachAvailability(payload);

      setCoachAvailability((previousItems) => {
        if (coachAvailabilityForm.id) {
          return previousItems
            .map((item) => (item.id === savedRecord.id ? savedRecord : item))
            .sort((left, right) => new Date(left.start_date) - new Date(right.start_date));
        }

        return [...previousItems, savedRecord].sort((left, right) => new Date(left.start_date) - new Date(right.start_date));
      });
      setCoachAvailabilityForm(buildAvailabilityForm());
    } catch (error) {
      setCoachAvailabilityError(error?.message || 'Unable to save availability.');
    } finally {
      setCoachAvailabilitySubmitting(false);
    }
  };

  const handleRecurringFormChange = (field, value) => {
    setCoachRecurringForm((previousForm) => ({
      ...previousForm,
      [field]: value,
    }));
  };

  const handleSaveRecurringAvailability = async () => {
    if (!currentUser?.id) {
      return;
    }

    const safeDay = Number(coachRecurringForm.dayOfWeek);
    const safeStart = String(coachRecurringForm.startTime || '').trim();
    const safeEnd = String(coachRecurringForm.endTime || '').trim();
    const timePattern = /^\d{2}:\d{2}$/;

    if (!Number.isInteger(safeDay) || safeDay < 0 || safeDay > 6) {
      setCoachRecurringError('Select a valid day of week.');
      return;
    }

    if (!timePattern.test(safeStart) || !timePattern.test(safeEnd)) {
      setCoachRecurringError('Enter time in HH:MM format.');
      return;
    }

    if (safeStart >= safeEnd) {
      setCoachRecurringError('End time must be later than start time.');
      return;
    }

    setCoachRecurringSubmitting(true);
    setCoachRecurringError('');

    const payload = {
      coach_id: currentUser.id,
      day_of_week: safeDay,
      start_time: safeStart,
      end_time: safeEnd,
      is_active: coachRecurringForm.isActive,
    };

    try {
      const savedRecord = coachRecurringForm.id
        ? await mobileApi.updateCoachRecurringAvailability(coachRecurringForm.id, payload)
        : await mobileApi.createCoachRecurringAvailability(payload);

      setCoachRecurringAvailability((previousItems) => {
        if (coachRecurringForm.id) {
          return previousItems
            .map((item) => (item.id === savedRecord.id ? savedRecord : item))
            .sort((left, right) => {
              if (left.day_of_week === right.day_of_week) {
                return String(left.start_time).localeCompare(String(right.start_time));
              }
              return Number(left.day_of_week) - Number(right.day_of_week);
            });
        }

        return [...previousItems, savedRecord].sort((left, right) => {
          if (left.day_of_week === right.day_of_week) {
            return String(left.start_time).localeCompare(String(right.start_time));
          }
          return Number(left.day_of_week) - Number(right.day_of_week);
        });
      });
      setCoachRecurringForm(buildRecurringAvailabilityForm());
    } catch (error) {
      setCoachRecurringError(error?.message || 'Unable to save recurring availability.');
    } finally {
      setCoachRecurringSubmitting(false);
    }
  };

  const handleEditRecurringAvailability = (item) => {
    setCoachRecurringError('');
    setCoachRecurringForm(buildRecurringAvailabilityForm(item));
  };

  const handleDeleteRecurringAvailability = async (item) => {
    if (!item?.id) {
      return;
    }

    setCoachRecurringSubmitting(true);
    setCoachRecurringError('');

    try {
      await mobileApi.deleteCoachRecurringAvailability(item.id);
      setCoachRecurringAvailability((previousItems) => previousItems.filter((record) => record.id !== item.id));
      if (coachRecurringForm.id === item.id) {
        setCoachRecurringForm(buildRecurringAvailabilityForm());
      }
    } catch (error) {
      setCoachRecurringError(error?.message || 'Unable to delete recurring availability.');
    } finally {
      setCoachRecurringSubmitting(false);
    }
  };

  const handleEditAvailability = (item) => {
    setCoachAvailabilityError('');
    setCoachAvailabilityForm(buildAvailabilityForm(item));
  };

  const handleDeleteAvailability = async (item) => {
    if (!item?.id) {
      return;
    }

    setCoachAvailabilitySubmitting(true);
    setCoachAvailabilityError('');

    try {
      await mobileApi.deleteCoachAvailability(item.id);
      setCoachAvailability((previousItems) => previousItems.filter((record) => record.id !== item.id));
      if (coachAvailabilityForm.id === item.id) {
        setCoachAvailabilityForm(buildAvailabilityForm());
      }
    } catch (error) {
      setCoachAvailabilityError(error?.message || 'Unable to delete availability.');
    } finally {
      setCoachAvailabilitySubmitting(false);
    }
  };

  const handleSendBookingMessage = async () => {
    if (!selectedBooking?.id || !currentUser?.id) {
      return;
    }

    const draft = String(messageDrafts[selectedBooking.id] || '');
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    const recipient = getBookingMessageRecipient(selectedBooking, currentUser, recipientForAdmin);
    if (!recipient.id) {
      setBookingMessagesError('Unable to determine who should receive this message.');
      return;
    }

    setSendingMessage(true);
    setBookingMessagesError('');

    try {
      const createdMessage = await mobileApi.sendMessage({
        booking_id: selectedBooking.id,
        sender_id: currentUser.id,
        receiver_id: recipient.id,
        content: trimmedDraft,
      });

      setBookingMessages((previousMessages) => [
        ...previousMessages,
        {
          ...createdMessage,
          content: trimmedDraft,
          sender_id: currentUser.id,
          receiver_id: recipient.id,
          created_date: createdMessage?.created_date || new Date().toISOString(),
          is_read: false,
        },
      ]);
      setMessageDrafts((previousDrafts) => ({
        ...previousDrafts,
        [selectedBooking.id]: '',
      }));

      await loadBookingMessages(selectedBooking, currentUser);
    } catch (error) {
      setBookingMessagesError(`${error?.message || 'Unable to send message.'} Draft kept on this device.`);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!selectedDirectThread?.direct_user_id || !currentUser?.id) {
      return;
    }

    const draftKey = `direct-${selectedDirectThread.direct_user_id}`;
    const draft = String(messageDrafts[draftKey] || '');
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    setSendingMessage(true);
    setDirectMessagesError('');

    try {
      const createdMessage = await mobileApi.sendMessage({
        sender_id: currentUser.id,
        receiver_id: selectedDirectThread.direct_user_id,
        content: trimmedDraft,
      });

      setDirectMessages((previousMessages) => [
        ...previousMessages,
        {
          ...createdMessage,
          content: trimmedDraft,
          sender_id: currentUser.id,
          receiver_id: selectedDirectThread.direct_user_id,
          created_date: createdMessage?.created_date || new Date().toISOString(),
          is_read: false,
        },
      ]);
      setMessageDrafts((previousDrafts) => ({
        ...previousDrafts,
        [draftKey]: '',
      }));

      await Promise.allSettled([
        loadDirectMessages(selectedDirectThread, currentUser),
        loadMessageConversations(currentUser, profile),
      ]);
    } catch (error) {
      setDirectMessagesError(`${error?.message || 'Unable to send message.'} Draft kept on this device.`);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateAdminInvite = async () => {
    const safeEmail = String(adminInviteEmail || '').trim().toLowerCase();
    const safeScope = String(adminInviteScope || '').trim() || 'support';
    const safeHours = Number(adminInviteHours || 72);

    if (!safeEmail) {
      setAdminInviteError('Admin invite email is required.');
      return;
    }

    setAdminInviteSubmitting(true);
    setAdminInviteError('');

    try {
      await mobileApi.createAdminInvite({
        email: safeEmail,
        admin_scope: safeScope,
        expires_in_hours: Number.isFinite(safeHours) ? safeHours : 72,
      });
      setAdminInviteEmail('');
      await loadAdminOperations(currentUser, profile);
    } catch (error) {
      setAdminInviteError(error?.message || 'Unable to create admin invite.');
    } finally {
      setAdminInviteSubmitting(false);
    }
  };

  const handleRevokeAdminSession = async (userId) => {
    setAdminRevokeSessionLoadingId(userId);
    try {
      await mobileApi.revokeUserSessions(userId);
      await loadAdminOperations(currentUser, profile);
    } catch {
      // silent - refresh will show current state
    } finally {
      setAdminRevokeSessionLoadingId(null);
    }
  };

  const handleRevokeAdminInvite = async (inviteId) => {
    setAdminRevokeInviteLoadingId(inviteId);
    try {
      await mobileApi.revokeAdminInvite(inviteId);
      await loadAdminOperations(currentUser, profile);
    } catch {
      // silent
    } finally {
      setAdminRevokeInviteLoadingId(null);
    }
  };

  const syncUpdatedBooking = (updatedBooking) => {
    setSelectedBooking(updatedBooking);
    setBookingsViewItems((previousBookings) => previousBookings.map((booking) => (
      booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking
    )));
    setAdminBookings((previousBookings) => previousBookings.map((booking) => (
      booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking
    )));
    setDashboard((previousDashboard) => {
      if (!previousDashboard?.bookings) return previousDashboard;
      return {
        ...previousDashboard,
        bookings: previousDashboard.bookings.map((booking) => (
          booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking
        )),
      };
    });
    setMessageConversations((previousConversations) => previousConversations.map((conversation) => (
      conversation.booking_id === updatedBooking.id
        ? { ...conversation, booking: { ...conversation.booking, ...updatedBooking } }
        : conversation
    )));
  };

  const performBookingAction = async (payload) => {
    if (!selectedBooking?.id) {
      return;
    }

    setBookingActionLoading(true);
    setBookingActionError('');

    try {
      const updatedBooking = await mobileApi.updateBooking(selectedBooking.id, payload);
      syncUpdatedBooking(updatedBooking);
      await Promise.allSettled([
        loadBookingsView(currentUser, profile),
        loadAdminBookings(currentUser, profile),
        loadDashboard(currentUser, profile),
        loadMessageConversations(currentUser, profile),
      ]);
      return updatedBooking;
    } catch (error) {
      setBookingActionError(error?.message || 'Unable to update booking.');
      throw error;
    } finally {
      setBookingActionLoading(false);
    }
  };

  const openRescheduleScreen = () => {
    setBookingActionError('');
    setRescheduleDate(formatDateInputValue(selectedBooking?.reschedule_proposed_date || selectedBooking?.booking_date));
    setRescheduleTime(formatTimeInputValue(selectedBooking?.reschedule_proposed_date || selectedBooking?.booking_date));
    setView('booking_reschedule');
  };

  const handleRequestReschedule = async () => {
    const nextProposedDate = buildIsoDateTime(rescheduleDate, rescheduleTime);
    if (!nextProposedDate) {
      setBookingActionError('Enter a valid date and time in the format YYYY-MM-DD and HH:MM.');
      return;
    }

    try {
      await performBookingAction({
        reschedule_requested_by: currentUser.id,
        reschedule_proposed_date: nextProposedDate,
        reschedule_status: 'pending',
        reschedule_requested_at: new Date().toISOString(),
      });
      setView('booking_detail');
    } catch {
      // Error state already set in performBookingAction.
    }
  };

  const handleAcceptReschedule = async () => {
    if (!selectedBooking?.reschedule_proposed_date) {
      setBookingActionError('No proposed reschedule time is available.');
      return;
    }

    try {
      await performBookingAction({
        booking_date: selectedBooking.reschedule_proposed_date,
        reschedule_status: 'accepted',
        reschedule_requested_by: null,
        reschedule_proposed_date: null,
        reschedule_requested_at: null,
      });
      setView('booking_detail');
    } catch {
      // Error state already set in performBookingAction.
    }
  };

  const handleDeclineReschedule = async () => {
    try {
      await performBookingAction({
        reschedule_status: 'declined',
        reschedule_requested_by: null,
        reschedule_proposed_date: null,
        reschedule_requested_at: null,
      });
      setView('booking_detail');
    } catch {
      // Error state already set in performBookingAction.
    }
  };

  const openMessagesInboxView = async () => {
    await loadMessageConversations(currentUser, profile);
    setView('messages_inbox');
  };

  const openAdminUsersView = async () => {
    await loadAdminUsers(currentUser, profile);
    setView('admin_users');
  };

  const openAdminCoachesView = async () => {
    await loadAdminCoaches(currentUser, profile);
    setView('admin_coaches');
  };

  const openAdminClientsView = async () => {
    await loadAdminClients(currentUser, profile);
    setView('admin_clients');
  };

  const openAdminBookingsView = async () => {
    await loadAdminBookings(currentUser, profile);
    setView('admin_bookings');
  };

  const openAdminPendingView = async () => {
    await loadAdminPending(currentUser, profile);
    setView('admin_pending');
  };

  const loadAdminFilteredBookings = async (status, nextUser = currentUser, nextProfile = profile) => {
    if (normalizeUserType(nextProfile?.user_type || nextUser?.user_type || 'client') !== 'admin') {
      setAdminFilteredBookings([]);
      setAdminFilteredError('');
      return;
    }
    setAdminFilteredLoading(true);
    setAdminFilteredError('');
    setAdminFilteredStatus(status);
    try {
      const response = await mobileApi.getBookings({
        view: 'admin_list',
        status,
        limit: 50,
        offset: 0,
        orderBy: '-created_at',
      });
      const rows = Array.isArray(response) ? response : response?.data || [];
      setAdminFilteredBookings(rows);
    } catch (error) {
      setAdminFilteredBookings([]);
      setAdminFilteredError(error?.message || `Unable to load ${status} bookings.`);
    } finally {
      setAdminFilteredLoading(false);
    }
  };

  const openAdminFilteredView = async (status) => {
    await loadAdminFilteredBookings(status, currentUser, profile);
    setView('admin_filtered');
  };
  const openAdminOperationsView = async (options = {}) => {
    const nextCaseFilter = String(options.caseFilter ?? adminCaseFilter ?? 'all');
    const nextDisputeFilter = String(options.disputeFilter ?? adminDisputeFilter ?? 'all');
    const nextVerificationFilter = String(options.verificationFilter ?? adminVerificationFilter ?? 'pending');
    const nextCaseLimit = Number(options.caseLimit ?? 5);
    const nextDisputeLimit = Number(options.disputeLimit ?? 5);
    const nextVerificationLimit = Number(options.verificationLimit ?? 6);

    setAdminCaseFilter(nextCaseFilter);
    setAdminDisputeFilter(nextDisputeFilter);
    setAdminVerificationFilter(nextVerificationFilter);
    setAdminCaseLimit(nextCaseLimit);
    setAdminDisputeLimit(nextDisputeLimit);
    setAdminVerificationLimit(nextVerificationLimit);

    await loadAdminOperations(currentUser, profile, {
      caseFilter: nextCaseFilter,
      disputeFilter: nextDisputeFilter,
      verificationFilter: nextVerificationFilter,
      caseLimit: nextCaseLimit,
      disputeLimit: nextDisputeLimit,
      verificationLimit: nextVerificationLimit,
    });
    setView('admin_operations');
  };

  const openAdminVerificationsView = async () => {
    await openAdminOperationsView({
      verificationFilter: 'pending',
      caseFilter: 'all',
      disputeFilter: 'all',
      caseLimit: 5,
      disputeLimit: 5,
      verificationLimit: 6,
    });
    setView('admin_verifications');
  };

  const loadAdminAuditLogs = async (options = {}) => {
    setAdminAuditLogsLoading(true);
    setAdminAuditLogsError('');
    const action = options.action ?? adminAuditAction;
    const limit = options.limit ?? adminAuditLimit;
    const filters = { limit, offset: 0, include_total: 1 };
    if (action !== 'all') filters.action = action;
    try {
      const response = await mobileApi.getAdminAuditLogs(filters);
      setAdminAuditLogs(Array.isArray(response?.data) ? response.data : []);
      setAdminAuditTotal(Number(response?.total || 0));
    } catch {
      setAdminAuditLogsError('Failed to load audit logs.');
    } finally {
      setAdminAuditLogsLoading(false);
    }
  };

  const openAdminAuditLogsView = async () => {
    setAdminAuditAction('all');
    setAdminAuditLimit(25);
    await loadAdminAuditLogs({ action: 'all', limit: 25 });
    setView('admin_audit_logs');
  };

  const loadHelpFaqs = async (nextProfile = profile) => {
    const isAdmin = normalizeUserType(nextProfile?.user_type) === 'admin';
    setHelpLoading(true);
    setHelpError('');
    try {
      const opts = isAdmin ? { include_inactive: 1 } : {};
      const res = await mobileApi.getFaqEntries(opts);
      const rows = (res?.faqs || []).map(normalizeFaqRow);
      setHelpFaqs(rows.filter(r => r.is_active));
      if (isAdmin) setHelpAllFaqs(rows);
    } catch {
      setHelpError('Failed to load FAQs. Please try again.');
    } finally {
      setHelpLoading(false);
    }
  };

  const openAdminHelpView = async () => {
    setHelpSearchTerm('');
    setHelpCategory('all');
    setHelpExpandedIds([]);
    setHelpEditorEntry(null);
    setHelpEditorError('');
    await loadHelpFaqs(profile);
    setView('admin_help');
  };

  const FIND_COACHES_PAGE_SIZE = 12;

  const loadFindCoaches = async (page = 0, query = findCoachesQuery, serviceType = findCoachesServiceType) => {
    setFindCoachesLoading(true);
    setFindCoachesError('');
    try {
      const filters = {
        limit: FIND_COACHES_PAGE_SIZE,
        offset: page * FIND_COACHES_PAGE_SIZE,
        include_total: '1',
      };
      if (query.trim()) filters.q = query.trim();
      if (serviceType) filters.service_type = serviceType;
      const response = await mobileApi.getCoaches(filters);
      const rows = Array.isArray(response) ? response : response?.data || [];
      const total = !Array.isArray(response)
        ? Number(response?.total || rows.length)
        : rows.length > 0 ? Number(rows[0]?.total_count || rows.length) : 0;
      setFindCoachesItems(rows);
      setFindCoachesTotal(total);
      setFindCoachesPage(page);
    } catch (error) {
      setFindCoachesError(error?.message || 'Unable to load coaches.');
      setFindCoachesItems([]);
    } finally {
      setFindCoachesLoading(false);
    }
  };

  const openFindCoachesView = async () => {
    setFindCoachesQuery('');
    setFindCoachesServiceType('');
    await loadFindCoaches(0, '', '');
    setView('find_coaches');
  };

  const handleSubmitNewBooking = async () => {
    if (!selectedCoach?.id || !currentUser?.id) {
      setNewBookingError('Coach or user session not found. Please go back and try again.');
      return;
    }
    if (!newBookingServiceType) {
      setNewBookingError('Please select a service type.');
      return;
    }
    if (!newBookingDate.trim() || !newBookingTime.trim()) {
      setNewBookingError('Please enter a date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }
    const isoDateTime = buildIsoDateTime(newBookingDate.trim(), newBookingTime.trim());
    if (!isoDateTime) {
      setNewBookingError('Invalid date or time. Use YYYY-MM-DD and HH:MM.');
      return;
    }
    const hourlyRate = Number(selectedCoach?.hourly_rate || 0);
    const adminFee = 3;
    const totalPrice = hourlyRate + adminFee;
    setNewBookingSubmitting(true);
    setNewBookingError('');
    setNewBookingSuccess('');
    try {
      await mobileApi.createBooking({
        coach_id: selectedCoach.id,
        client_id: currentUser.id,
        service_type: newBookingServiceType,
        booking_date: isoDateTime,
        duration: 60,
        location_type: newBookingLocationType,
        location_address: newBookingLocationType === 'in_person' ? (newBookingAddress.trim() || null) : null,
        location_notes: null,
        client_notes: newBookingNotes.trim() || null,
        price: hourlyRate,
        admin_fee: adminFee,
        total_price: totalPrice,
        status: 'pending',
      });
      setNewBookingSuccess('Booking request sent! The coach will confirm it shortly.');
      setNewBookingDate('');
      setNewBookingTime('');
      setNewBookingNotes('');
      setNewBookingAddress('');
      setTimeout(() => {
        loadDashboard(currentUser, profile);
        setView('account');
      }, 1500);
    } catch (error) {
      setNewBookingError(error?.message || 'Unable to submit booking. Please try again.');
    } finally {
      setNewBookingSubmitting(false);
    }
  };

  if (bootstrapping) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading FACT Mobile</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />
        {view === 'login_picker' ? (
          <LoginPickerScreen
            onBack={() => setView('home')}
            onSelectEmail={() => setView('sign_in')}
            onSelectGoogle={handleGoogleSignIn}
          />
        ) : view === 'sign_in' ? (
          <SignInScreen
            email={email}
            password={password}
            errorMessage={errorMessage}
            submitting={submitting}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onBack={() => setView('login_picker')}
            onSubmit={handleSignIn}
          />
        ) : view === 'bookings' ? (
          <BookingListScreen
            accountType={normalizeUserType(profile?.user_type || currentUser?.user_type || 'client')}
            bookings={bookingsViewItems}
            loading={bookingsViewLoading}
            errorMessage={bookingsViewError}
            onBack={() => setView('account')}
            onRefresh={() => loadBookingsView(currentUser, profile)}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking);
              setView('booking_detail');
            }}
          />
        ) : view === 'admin_users' ? (
          <AdminUsersScreen
            users={adminUsers}
            total={adminUsersTotal}
            loading={adminUsersLoading}
            errorMessage={adminUsersError}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminUsers(currentUser, profile)}
          />
        ) : view === 'admin_coaches' ? (
          <AdminUsersScreen
            users={adminCoaches}
            total={adminCoachesTotal}
            loading={adminCoachesLoading}
            errorMessage={adminCoachesError}
            screenTitle="Coaches"
            screenHeading="All registered coaches"
            screenSubtitle="Review every coach account currently registered in the platform."
            onBack={() => setView('account')}
            onRefresh={() => loadAdminCoaches(currentUser, profile)}
          />
        ) : view === 'admin_clients' ? (
          <AdminUsersScreen
            users={adminClients}
            total={adminClientsTotal}
            loading={adminClientsLoading}
            errorMessage={adminClientsError}
            screenTitle="Clients"
            screenHeading="All registered clients"
            screenSubtitle="Review every client account currently registered in the platform."
            onBack={() => setView('account')}
            onRefresh={() => loadAdminClients(currentUser, profile)}
          />
        ) : view === 'admin_bookings' ? (
          <BookingListScreen
            accountType="admin"
            bookings={adminBookings}
            loading={adminBookingsLoading}
            errorMessage={adminBookingsError}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminBookings(currentUser, profile)}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking);
              setView('booking_detail');
            }}
          />
        ) : view === 'admin_pending' ? (
          <BookingListScreen
            accountType="admin"
            bookings={adminPending}
            loading={adminPendingLoading}
            errorMessage={adminPendingError}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminPending(currentUser, profile)}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking);
              setView('booking_detail');
            }}
            titleOverride="Pending Bookings"
            subtitleOverride="Bookings awaiting confirmation from coaches or clients."
          />
        ) : view === 'admin_filtered' ? (
          <BookingListScreen
            accountType="admin"
            bookings={adminFilteredBookings}
            loading={adminFilteredLoading}
            errorMessage={adminFilteredError}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminFilteredBookings(adminFilteredStatus, currentUser, profile)}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking);
              setView('booking_detail');
            }}
            titleOverride={`${adminFilteredStatus.charAt(0).toUpperCase() + adminFilteredStatus.slice(1)} Bookings`}
            subtitleOverride={`Bookings with status: ${adminFilteredStatus}.`}
          />
        ) : view === 'messages_inbox' ? (
          <MessagesInboxScreen
            conversations={messageConversations}
            loading={messageConversationsLoading}
            errorMessage={messageConversationsError}
            onBack={() => setView('account')}
            onRefresh={() => loadMessageConversations(currentUser, profile)}
            onOpenConversation={async (conversation) => {
              setMessageOriginView('messages_inbox');

              if (conversation.type === 'direct') {
                setSelectedDirectThread(conversation);
                setDirectMessages([]);
                setDirectMessagesError('');
                await loadDirectMessages(conversation, currentUser);
                setView('direct_messages');
                return;
              }

              setSelectedDirectThread(null);
              setSelectedBooking(conversation.booking);
              setBookingMessages([]);
              setBookingMessagesError('');
              await loadBookingMessages(conversation.booking, currentUser);
              setView('booking_messages');
            }}
          />
        ) : view === 'admin_operations' ? (
          <AdminOperationsScreen
            overview={adminOpsOverview}
            weekly={adminOpsWeekly}
            cases={adminOpsCases}
            disputes={adminOpsDisputes}
            expiring={adminOpsExpiring}
            verifications={adminVerifications}
            caseFilter={adminCaseFilter}
            disputeFilter={adminDisputeFilter}
            caseDrafts={adminCaseDrafts}
            disputeDrafts={adminDisputeDrafts}
            verificationFilter={adminVerificationFilter}
            caseTotal={adminCaseTotal}
            disputeTotal={adminDisputeTotal}
            verificationTotal={adminVerificationTotal}
            verificationNotes={adminVerificationNotes}
            caseSubmittingId={adminCaseSubmittingId}
            disputeSubmittingId={adminDisputeSubmittingId}
            verificationSubmittingId={adminVerificationSubmittingId}
            caseError={adminCaseError}
            disputeError={adminDisputeError}
            verificationError={adminVerificationError}
            caseSuccess={adminCaseSuccess}
            disputeSuccess={adminDisputeSuccess}
            verificationSuccess={adminVerificationSuccess}
            loading={adminOpsLoading}
            errorMessage={adminOpsError}
            inviteEmail={adminInviteEmail}
            inviteScope={adminInviteScope}
            inviteHours={adminInviteHours}
            inviteSubmitting={adminInviteSubmitting}
            inviteError={adminInviteError}
            onInviteEmailChange={setAdminInviteEmail}
            onInviteScopeChange={setAdminInviteScope}
            onInviteHoursChange={setAdminInviteHours}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminOperations(currentUser, profile)}
            onCreateInvite={handleCreateAdminInvite}
            onCaseDraftChange={handleAdminCaseDraftChange}
            onDisputeDraftChange={handleAdminDisputeDraftChange}
            onSaveCase={handleSaveAdminCase}
            onAssignCaseToCurrentAdmin={handleAssignAdminCaseToCurrentAdmin}
            onSaveDispute={handleSaveBookingDispute}
            onAssignDisputeToCurrentAdmin={handleAssignBookingDisputeToCurrentAdmin}
            onCaseFilterChange={async (status) => {
              setAdminCaseFilter(status);
              setAdminCaseLimit(5);
              setAdminCaseSuccess('');
              await loadAdminOperations(currentUser, profile, { caseFilter: status, caseLimit: 5 });
            }}
            onDisputeFilterChange={async (status) => {
              setAdminDisputeFilter(status);
              setAdminDisputeLimit(5);
              setAdminDisputeSuccess('');
              await loadAdminOperations(currentUser, profile, { disputeFilter: status, disputeLimit: 5 });
            }}
            onLoadMoreCases={async () => {
              const nextLimit = adminCaseLimit + 5;
              setAdminCaseLimit(nextLimit);
              await loadAdminOperations(currentUser, profile, { caseLimit: nextLimit });
            }}
            onLoadMoreDisputes={async () => {
              const nextLimit = adminDisputeLimit + 5;
              setAdminDisputeLimit(nextLimit);
              await loadAdminOperations(currentUser, profile, { disputeLimit: nextLimit });
            }}
            onLoadMoreVerifications={async () => {
              const nextLimit = adminVerificationLimit + 6;
              setAdminVerificationLimit(nextLimit);
              await loadAdminOperations(currentUser, profile, { verificationLimit: nextLimit });
            }}
            onVerificationFilterChange={async (status) => {
              setAdminVerificationFilter(status);
              setAdminVerificationLimit(6);
              setAdminVerificationSuccess('');
              await loadAdminOperations(currentUser, profile, { verificationFilter: status, verificationLimit: 6 });
            }}
            onVerificationNoteChange={handleVerificationNoteChange}
            onUpdateVerification={handleUpdateVerification}
            adminUsers={adminOpsUsers}
            adminInvites={adminOpsInvites}
            snapshots={adminOpsSnapshots}
            snapshotsTotal={adminOpsSnapshotsTotal}
            signupAttempts={adminOpsSignupAttempts}
            signupTotal={adminOpsSignupTotal}
            revokeSessionLoadingId={adminRevokeSessionLoadingId}
            revokeInviteLoadingId={adminRevokeInviteLoadingId}
            onRevokeSession={handleRevokeAdminSession}
            onRevokeInvite={handleRevokeAdminInvite}
            onLoadMoreSignupAttempts={async () => {
              const nextLimit = adminOpsSignupLimit + 10;
              setAdminOpsSignupLimit(nextLimit);
              const result = await mobileApi.listAuthLogs({ event_type: 'signup', include_total: 1, limit: nextLimit, offset: 0 });
              setAdminOpsSignupAttempts(result?.data || []);
              setAdminOpsSignupTotal(Number(result?.total || 0));
            }}
          />
        ) : view === 'admin_verifications' ? (
          <AdminVerificationsScreen
            verifications={adminVerifications}
            verificationFilter={adminVerificationFilter}
            verificationTotal={adminVerificationTotal}
            verificationNotes={adminVerificationNotes}
            verificationSubmittingId={adminVerificationSubmittingId}
            verificationError={adminVerificationError}
            verificationSuccess={adminVerificationSuccess}
            loading={adminOpsLoading}
            errorMessage={adminOpsError}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminOperations(currentUser, profile, { verificationFilter: adminVerificationFilter, verificationLimit: adminVerificationLimit })}
            onVerificationFilterChange={async (status) => {
              setAdminVerificationFilter(status);
              setAdminVerificationLimit(6);
              setAdminVerificationSuccess('');
              await loadAdminOperations(currentUser, profile, { verificationFilter: status, verificationLimit: 6 });
            }}
            onVerificationNoteChange={handleVerificationNoteChange}
            onUpdateVerification={handleUpdateVerification}
            onLoadMoreVerifications={async () => {
              const nextLimit = adminVerificationLimit + 6;
              setAdminVerificationLimit(nextLimit);
              await loadAdminOperations(currentUser, profile, { verificationLimit: nextLimit });
            }}
          />
        ) : view === 'admin_audit_logs' ? (
          <AdminAuditLogsScreen
            auditLogs={adminAuditLogs}
            auditTotal={adminAuditTotal}
            auditAction={adminAuditAction}
            loading={adminAuditLogsLoading}
            errorMessage={adminAuditLogsError}
            onBack={() => setView('account')}
            onRefresh={() => loadAdminAuditLogs()}
            onActionFilterChange={async (action) => {
              setAdminAuditAction(action);
              setAdminAuditLimit(25);
              await loadAdminAuditLogs({ action, limit: 25 });
            }}
            onLoadMore={async () => {
              const nextLimit = adminAuditLimit + 25;
              setAdminAuditLimit(nextLimit);
              await loadAdminAuditLogs({ limit: nextLimit });
            }}
          />
        ) : view === 'admin_help' ? (
          <HelpScreen
            profile={profile}
            faqs={helpFaqs}
            allFaqs={helpAllFaqs}
            loading={helpLoading}
            errorMessage={helpError}
            searchTerm={helpSearchTerm}
            category={helpCategory}
            expandedIds={helpExpandedIds}
            editorEntry={helpEditorEntry}
            editorSaving={helpEditorSaving}
            editorError={helpEditorError}
            onBack={() => setView('account')}
            onRefresh={() => loadHelpFaqs(profile)}
            onSearchChange={setHelpSearchTerm}
            onCategoryChange={setHelpCategory}
            onToggleExpand={(id) => setHelpExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            onOpenMessages={openMessagesInboxView}
            onStartAdd={() => setHelpEditorEntry({ uuid: null, q: '', a: '', role: 'both', category: 'onboarding', is_active: true })}
            onStartEdit={(faq) => setHelpEditorEntry({ ...faq })}
            onDeleteFaq={async (faq) => {
              if (!faq.uuid) return;
              try {
                await mobileApi.deleteFaqEntry(faq.uuid);
                await loadHelpFaqs(profile);
              } catch {
                setHelpEditorError('Failed to delete FAQ.');
              }
            }}
            onSaveEditor={async () => {
              if (!helpEditorEntry) return;
              setHelpEditorSaving(true);
              setHelpEditorError('');
              try {
                const { uuid, q, a, role, category, is_active, position } = helpEditorEntry;
                const payload = { question: q, answer: a, role, category, is_active, position };
                if (uuid) {
                  await mobileApi.updateFaqEntry(uuid, payload);
                } else {
                  await mobileApi.createFaqEntry({ ...payload, slug: `faq-${Date.now()}` });
                }
                setHelpEditorEntry(null);
                await loadHelpFaqs(profile);
              } catch {
                setHelpEditorError('Failed to save FAQ. Please check all fields.');
              } finally {
                setHelpEditorSaving(false);
              }
            }}
            onCancelEditor={() => { setHelpEditorEntry(null); setHelpEditorError(''); }}
            onEditorChange={(field, value) => setHelpEditorEntry(prev => ({ ...prev, [field]: value }))}
          />
        ) : view === 'coach_operations' ? (
          <CoachOperationsScreen
            profile={profile}
            profileForm={coachProfileForm}
            complianceForm={coachComplianceForm}
            availability={coachAvailability}
            recurringAvailability={coachRecurringAvailability}
            availabilityForm={coachAvailabilityForm}
            recurringForm={coachRecurringForm}
            loading={coachOpsLoading}
            errorMessage={coachOpsError}
            profileSubmitting={coachProfileSubmitting}
            profileError={coachProfileError}
            complianceSubmitting={coachComplianceSubmitting}
            complianceError={coachComplianceError}
            uploadSubmitting={coachComplianceUploadSubmitting}
            uploadError={coachComplianceUploadError}
            availabilitySubmitting={coachAvailabilitySubmitting}
            availabilityError={coachAvailabilityError}
            recurringSubmitting={coachRecurringSubmitting}
            recurringError={coachRecurringError}
            onBack={() => setView('account')}
            onRefresh={() => loadCoachOperations(currentUser, profile)}
            onProfileChange={handleCoachProfileChange}
            onProfileToggle={handleCoachProfileToggle}
            onSaveProfile={handleSaveCoachProfile}
            onComplianceChange={handleComplianceChange}
            onUploadComplianceDocument={handleUploadComplianceDocument}
            onAvailabilityFormChange={handleAvailabilityFormChange}
            onRecurringFormChange={handleRecurringFormChange}
            onSaveCompliance={handleSaveCompliance}
            onSaveAvailability={handleSaveAvailability}
            onSaveRecurring={handleSaveRecurringAvailability}
            onEditAvailability={handleEditAvailability}
            onDeleteAvailability={handleDeleteAvailability}
            onEditRecurring={handleEditRecurringAvailability}
            onDeleteRecurring={handleDeleteRecurringAvailability}
            onResetAvailabilityForm={() => setCoachAvailabilityForm(buildAvailabilityForm())}
            onResetRecurringForm={() => setCoachRecurringForm(buildRecurringAvailabilityForm())}
          />
        ) : view === 'booking_detail' && selectedBooking ? (
          <BookingDetailScreen
            booking={selectedBooking}
            currentUser={currentUser}
            actionLoading={bookingActionLoading}
            actionError={bookingActionError}
            onBack={() => setView('bookings')}
            onOpenReschedule={openRescheduleScreen}
            onConfirmBooking={() => performBookingAction({ accept: true })}
            onCancelBooking={() => performBookingAction({ cancel: true })}
            onCompleteBooking={() => performBookingAction({ status: 'completed' })}
            onOpenMessages={async () => {
              setMessageOriginView('booking_detail');
              setBookingMessages([]);
              setBookingMessagesError('');
              await loadBookingMessages(selectedBooking, currentUser);
              setView('booking_messages');
            }}
          />
        ) : view === 'booking_reschedule' && selectedBooking ? (
          <BookingRescheduleScreen
            booking={selectedBooking}
            currentUser={currentUser}
            dateValue={rescheduleDate}
            timeValue={rescheduleTime}
            submitting={bookingActionLoading}
            errorMessage={bookingActionError}
            onDateChange={setRescheduleDate}
            onTimeChange={setRescheduleTime}
            onBack={() => setView('booking_detail')}
            onRequest={handleRequestReschedule}
            onAccept={handleAcceptReschedule}
            onDecline={handleDeclineReschedule}
          />
        ) : view === 'booking_messages' && selectedBooking ? (
          <BookingMessagesScreen
            booking={selectedBooking}
            currentUser={currentUser}
            messages={bookingMessages}
            loading={bookingMessagesLoading}
            errorMessage={bookingMessagesError}
            draft={messageDrafts[selectedBooking.id] || ''}
            sending={sendingMessage}
            recipientForAdmin={recipientForAdmin}
            onRecipientChange={setRecipientForAdmin}
            onDraftChange={(value) => setMessageDrafts((previousDrafts) => ({
              ...previousDrafts,
              [selectedBooking.id]: value,
            }))}
            onBack={() => setView(messageOriginView)}
            onRefresh={() => loadBookingMessages(selectedBooking, currentUser)}
            onSend={handleSendBookingMessage}
          />
        ) : view === 'direct_messages' && selectedDirectThread ? (
          <DirectMessagesScreen
            thread={selectedDirectThread}
            currentUser={currentUser}
            messages={directMessages}
            loading={directMessagesLoading}
            errorMessage={directMessagesError}
            draft={messageDrafts[`direct-${selectedDirectThread.direct_user_id}`] || ''}
            sending={sendingMessage}
            onDraftChange={(value) => setMessageDrafts((previousDrafts) => ({
              ...previousDrafts,
              [`direct-${selectedDirectThread.direct_user_id}`]: value,
            }))}
            onBack={() => setView(messageOriginView)}
            onRefresh={() => loadDirectMessages(selectedDirectThread, currentUser)}
            onSend={handleSendDirectMessage}
          />
        ) : view === 'find_coaches' ? (
          <FindCoachesScreen
            coaches={findCoachesItems}
            loading={findCoachesLoading}
            errorMessage={findCoachesError}
            total={findCoachesTotal}
            page={findCoachesPage}
            pageSize={FIND_COACHES_PAGE_SIZE}
            searchQuery={findCoachesQuery}
            serviceType={findCoachesServiceType}
            onBack={() => setView('account')}
            onRefresh={() => loadFindCoaches(0, findCoachesQuery, findCoachesServiceType)}
            onSearch={(q) => {
              setFindCoachesQuery(q);
              loadFindCoaches(0, q, findCoachesServiceType);
            }}
            onServiceTypeChange={(st) => {
              setFindCoachesServiceType(st);
              loadFindCoaches(0, findCoachesQuery, st);
            }}
            onNextPage={() => loadFindCoaches(findCoachesPage + 1)}
            onPrevPage={() => loadFindCoaches(Math.max(0, findCoachesPage - 1))}
            onSelectCoach={(coach) => {
              setSelectedCoach(coach);
              setView('coach_detail');
            }}
          />
        ) : view === 'coach_detail' && selectedCoach ? (
          <CoachDetailScreen
            coach={selectedCoach}
            currentUser={currentUser}
            onBack={() => setView('find_coaches')}
            onBook={() => {
              const services = Array.isArray(selectedCoach?.services_offered) && selectedCoach.services_offered.length > 0
                ? selectedCoach.services_offered
                : [];
              setNewBookingServiceType(services.length === 1 ? services[0] : '');
              setNewBookingDate('');
              setNewBookingTime('');
              setNewBookingLocationType('online');
              setNewBookingAddress('');
              setNewBookingNotes('');
              setNewBookingError('');
              setNewBookingSuccess('');
              setView('new_booking');
            }}
          />
        ) : view === 'new_booking' && selectedCoach ? (
          <NewBookingScreen
            coach={selectedCoach}
            serviceType={newBookingServiceType}
            date={newBookingDate}
            time={newBookingTime}
            locationType={newBookingLocationType}
            locationAddress={newBookingAddress}
            notes={newBookingNotes}
            submitting={newBookingSubmitting}
            errorMessage={newBookingError}
            successMessage={newBookingSuccess}
            onServiceTypeChange={setNewBookingServiceType}
            onDateChange={setNewBookingDate}
            onTimeChange={setNewBookingTime}
            onLocationTypeChange={setNewBookingLocationType}
            onLocationAddressChange={setNewBookingAddress}
            onNotesChange={setNewBookingNotes}
            onBack={() => setView('coach_detail')}
            onSubmit={handleSubmitNewBooking}
          />
        ) : currentUser ? (
          <AuthenticatedHome
            currentUser={currentUser}
            profile={profile}
            loadingProfile={profileLoading}
            dashboardLoading={dashboardLoading}
            dashboardError={dashboardError}
            dashboard={dashboard}
            onRefresh={() => loadDashboard(currentUser, profile)}
            onOpenMessages={openMessagesInboxView}
            onOpenAdminUsers={openAdminUsersView}
            onOpenAdminCoaches={openAdminCoachesView}
            onOpenAdminClients={openAdminClientsView}
            onOpenAdminBookings={openAdminBookingsView}
                      onOpenAdminPending={openAdminPendingView}
                      onOpenAdminFilteredBookings={openAdminFilteredView}
            onOpenAdminVerifications={openAdminVerificationsView}
            onOpenAdminAuditLogs={openAdminAuditLogsView}
            onOpenAdminOperations={() => openAdminOperationsView({
              verificationFilter: 'pending',
              caseFilter: 'open',
              disputeFilter: 'open',
              caseLimit: 5,
              disputeLimit: 5,
              verificationLimit: 6,
            })}
            onOpenAdminHelp={openAdminHelpView}
            onOpenCoachOperations={async () => {
              await loadCoachOperations(currentUser, profile);
              setView('coach_operations');
            }}
            onOpenFindCoaches={openFindCoachesView}
            onOpenBookings={async () => {
              if (normalizeUserType(profile?.user_type || currentUser?.user_type || 'client') === 'admin') {
                await openAdminBookingsView();
                return;
              }
              await loadBookingsView(currentUser, profile);
              setView('bookings');
            }}
            onSignOut={handleSignOut}
          />
        ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1600&q=80' }}
            style={styles.hero}
            imageStyle={styles.heroImage}
          >
            <View style={styles.heroOverlay}>
              <View style={styles.brandRow}>
                <Image source={factIcon} style={styles.logo} />
                <Text style={styles.brandText}>FACT</Text>
              </View>

              <Text style={styles.title}>Elevate Your Game</Text>
              <Text style={styles.titleAccent}>With Expert Football Coaching</Text>
              <Text style={styles.subtitle}>
                Connect with top-tier football coaches for personalised training. Find local experts and book sessions to unlock your true potential on the pitch.
              </Text>
            </View>
          </ImageBackground>

          <View style={styles.content}>
            <View style={styles.heroCtaRow}>
              <Pressable
                onPress={() => openHref('https://findacoachtoday.com/findcoaches')}
                style={({ pressed }) => [styles.heroCtaPrimary, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.heroCtaPrimaryText}>Find a Coach</Text>
              </Pressable>
              <Pressable
                onPress={() => openHref('https://findacoachtoday.com/register?type=coach')}
                style={({ pressed }) => [styles.heroCtaGhost, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.heroCtaGhostText}>Become a Coach</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.loginLinkRow}
              onPress={() => {
                setEmail('');
                setPassword('');
                setErrorMessage('');
                setView('login_picker');
              }}
            >
              <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkEmphasis}>Login</Text></Text>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Train Like a Pro</Text>
              <Text style={styles.sectionSubtitle}>Access elite coaching tailored to every aspect of your game.</Text>
            </View>

            <View style={styles.featureGrid}>
              {featureCards.map((feature) => (
                <View key={feature.title} style={styles.card}>
                  <Text style={styles.cardTitle}>{feature.title}</Text>
                  <Text style={styles.cardCopy}>{feature.body}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bottomCtaSection}>
            <Text style={styles.bottomCtaTitle}>Ready to Transform Your Game?</Text>
            <Text style={styles.bottomCtaSubtitle}>
              Join thousands who&apos;ve found their perfect coach and achieved remarkable results. All payments are securely processed by Stripe.
            </Text>
            <Pressable
              onPress={() => openHref('https://findacoachtoday.com/findcoaches')}
              style={({ pressed }) => [styles.bottomCtaButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.bottomCtaButtonText}>Get Started Today</Text>
            </Pressable>
          </View>
        </ScrollView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08111f',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  signInScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  signInHeader: {
    marginBottom: 18,
  },
  brandRowCompact: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 18,
  },
  logoCompact: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
  },
  logoFallback: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    justifyContent: 'center',
  },
  logoFallbackText: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: '800',
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#243041',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  signInCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 22,
    marginTop: 18,
  },
  signInCardDark: {
    backgroundColor: '#08111f',
    borderColor: '#1e3a8a',
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    marginTop: 18,
  },
  signInTitle: {
    color: '#08111f',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 10,
  },
  signInTitleDark: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 10,
  },
  signInSubtitle: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  signInSubtitleDark: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  inlineActionButton: {
    alignSelf: 'flex-start',
    borderColor: '#243041',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inlineActionButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  loadMoreButton: {
    marginBottom: 0,
    marginTop: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputLabelLight: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 16,
    color: '#0f172a',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputDark: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderWidth: 1,
    borderRadius: 16,
    color: '#f8fafc',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchContainer: {
    marginBottom: 18,
    marginTop: 18,
  },
  searchLabel: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderColor: '#1e3a8a',
    borderWidth: 1,
    borderRadius: 12,
    color: '#f8fafc',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: 'Menlo',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  errorTextLight: {
    color: '#fca5a5',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  successTextLight: {
    color: '#86efac',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#08111f',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryLinkButton: {
    alignSelf: 'center',
    marginTop: 18,
  },
  secondaryLinkText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },
  messagesShell: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  hero: {
    minHeight: 480,
    justifyContent: 'flex-end',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    minHeight: 480,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    backgroundColor: 'rgba(6, 14, 28, 0.72)',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 28,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 16,
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  brandText: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  actionGroup: {
    gap: 14,
    marginTop: -28,
  },
  actionGroupSignedIn: {
    gap: 14,
    marginTop: 22,
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  actionButtonSecondary: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  actionButtonGhost: {
    backgroundColor: '#111827',
    borderColor: '#243041',
  },
  actionButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  actionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  actionTitleGhost: {
    color: '#f8fafc',
  },
  actionTitleSecondary: {
    color: '#f8fafc',
  },
  actionBody: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actionBodySecondary: {
    color: '#dbe4f3',
  },
  actionBodyGhost: {
    color: '#cbd5e1',
  },
  eyebrow: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
    maxWidth: 340,
  },
  titleAccent: {
    color: '#fdba74',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
    maxWidth: 340,
    marginBottom: 4,
  },
  subtitle: {
    color: '#dbe4f3',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 14,
    maxWidth: 340,
  },
  heroCtaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  heroCtaPrimary: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 16,
  },
  heroCtaPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  heroCtaGhost: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 16,
  },
  heroCtaGhostText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLinkRow: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  loginLinkText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loginLinkEmphasis: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  bottomCtaSection: {
    backgroundColor: '#0f1e35',
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
  },
  bottomCtaTitle: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    textAlign: 'center',
    marginBottom: 12,
  },
  bottomCtaSubtitle: {
    color: '#93c5fd',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  bottomCtaButton: {
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  bottomCtaButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 18,
  },
  sectionEyebrow: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    maxWidth: 320,
  },
  featureGrid: {
    gap: 14,
    marginBottom: 20,
  },
  sectionHeaderCompact: {
    marginBottom: 18,
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statTile: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    width: '48.5%',
    padding: 16,
    flexShrink: 0,
  },
  adminStatGrid: {
    gap: 10,
    marginBottom: 14,
  },
  adminStatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adminStatTile: {
    flex: 1,
    width: undefined,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  statValueSmall: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 6,
  },
  spotlightRow: {
    gap: 12,
    marginTop: 14,
    marginBottom: 18,
  },
  spotlightCard: {
    backgroundColor: '#0f172a',
    borderColor: '#1d4ed8',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  spotlightLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  spotlightValue: {
    color: '#f59e0b',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  dashboardLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  messageMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  messageMetaPill: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  recipientToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  filterToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  recipientToggle: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterToggle: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recipientToggleActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
  },
  recipientToggleText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  recipientToggleTextActive: {
    color: '#f8fafc',
  },
  bookingList: {
    gap: 12,
    marginBottom: 10,
  },
  bookingListLarge: {
    gap: 12,
  },
  conversationCard: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    position: 'relative',
  },
  conversationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conversationUnreadTitle: {
    color: '#ffffff',
  },
  conversationTime: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  conversationPreview: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    paddingRight: 14,
  },
  conversationPreviewUnread: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dualInputColumn: {
    flex: 1,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inlineButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  inlinePrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inlinePrimaryButtonText: {
    color: '#08111f',
    fontSize: 14,
    fontWeight: '800',
  },
  inlineSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inlineSecondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineDangerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(185, 28, 28, 0.18)',
    borderColor: '#7f1d1d',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inlineDangerButtonText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '700',
  },
  availabilityCard: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectionChip: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectionChipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
  },
  selectionChipText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  selectionChipTextActive: {
    color: '#f8fafc',
  },
  unreadDot: {
    backgroundColor: '#ef4444',
    borderRadius: 999,
    height: 10,
    position: 'absolute',
    right: 16,
    top: 16,
    width: 10,
  },
  messagesList: {
    gap: 10,
    paddingBottom: 18,
  },
  messageBubble: {
    borderRadius: 18,
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageBubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#f59e0b',
  },
  messageBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderWidth: 1,
  },
  messageSender: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageSenderOwn: {
    color: '#78350f',
  },
  messageBody: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 22,
  },
  messageBodyOwn: {
    color: '#08111f',
  },
  messageTimestamp: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  messageTimestampOwn: {
    color: 'rgba(8, 17, 31, 0.72)',
  },
  messageComposer: {
    gap: 12,
    marginTop: 16,
  },
  messageInput: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 18,
    borderWidth: 1,
    color: '#f8fafc',
    fontSize: 15,
    maxHeight: 140,
    minHeight: 104,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messageSendButton: {
    minHeight: 50,
  },
  messageSendButtonDisabled: {
    opacity: 0.45,
  },
  bookingCard: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  bookingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bookingTitle: {
    color: '#f8fafc',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  bookingStatusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bookingStatus: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pendingAlertBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pendingAlertText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
  },
  bookingPartner: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  bookingTabRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  bookingTab: {
    borderColor: '#1e3a8a',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  bookingTabActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  bookingTabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  bookingTabTextActive: {
    color: '#08111f',
  },
  bookingMeta: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: '#1e3a8a',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardCopy: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  metaCaption: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  compactListRow: {
    borderBottomColor: '#1e293b',
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  compactListTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  compactListMeta: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  // Coach card styles
  coachCard: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  coachCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  coachCardName: {
    color: '#f8fafc',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginRight: 8,
  },
  coachCardMeta: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  coachCardRate: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  coachCardBio: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  coachCardServices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  coachServiceChip: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coachServiceChipText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBadge: {
    backgroundColor: '#166534',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedBadgeText: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '700',
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    marginBottom: 4,
  },
});