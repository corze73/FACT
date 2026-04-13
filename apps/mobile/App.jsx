import React, { useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
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
import { getCurrentProfile, mobileApi, mobileAuth, signInWithEmail, signOut, uploadComplianceAsset } from './src/lib/mobileAuth';

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
    description: 'Browse verified football coaches and start training.',
    href: 'https://findacoachtoday.com/findcoaches',
    variant: 'primary',
  },
  {
    label: 'Sign In',
    description: 'Use your FACT email and password directly in the app.',
    variant: 'primary',
  },
  {
    label: 'Become a Coach',
    description: 'Create a coach profile and start receiving bookings.',
    href: 'https://findacoachtoday.com/register?type=coach',
    variant: 'primary',
  },
];

const featureCards = [
  {
    title: 'Verified coaches',
    body: 'Train with specialists across attacking, defending, conditioning, and technical development.',
  },
  {
    title: 'Book faster',
    body: 'Move from discovery to a live session without jumping between channels or spreadsheets.',
  },
  {
    title: 'Shared account system',
    body: `normalizeUserType('coach') = ${normalizeUserType('coach')}`,
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
      eyebrow: 'Admin overview',
      heading: 'Platform activity at a glance',
      subheading: 'A native summary of accounts, coaches, clients, and booking flow.',
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
        { label: 'Completed', value: completedCount },
      ],
      spotlight: [
        { label: 'Total sessions', value: bookings.length },
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

function BookingCard({ booking }) {
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{formatServiceType(booking.service_type)}</Text>
        <Text style={styles.bookingStatus}>{booking.status || 'pending'}</Text>
      </View>
      <Text style={styles.bookingMeta}>{formatSessionDate(getBookingDateValue(booking))}</Text>
      <Text style={styles.bookingMeta}>{booking.session_time || 'Time TBD'} • {formatPrice(booking.total_price || booking.price)}</Text>
    </View>
  );
}

function BookingListScreen({ accountType, bookings, loading, errorMessage, onBack, onRefresh, onSelectBooking }) {
  const title = accountType === 'admin' ? 'Booking Queue' : accountType === 'coach' ? 'Coach Sessions' : 'My Bookings';
  const subtitle = accountType === 'admin'
    ? 'Review recent booking activity from the native app.'
    : accountType === 'coach'
      ? 'See requests, confirmed sessions, and history in one place.'
      : 'Review your upcoming and past bookings without leaving the app.';

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

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineActionButton, pressed && styles.actionButtonPressed]}>
          <Text style={styles.inlineActionButtonText}>Refresh</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading bookings...</Text>
          </View>
        ) : bookings.length > 0 ? (
          <View style={styles.bookingListLarge}>
            {bookings.map((booking) => (
              <Pressable key={booking.id} onPress={() => onSelectBooking(booking)} style={({ pressed }) => [styles.bookingCard, pressed && styles.actionButtonPressed]}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingTitle}>{formatServiceType(booking.service_type)}</Text>
                  <Text style={styles.bookingStatus}>{booking.status || 'pending'}</Text>
                </View>
                <Text style={styles.bookingMeta}>{formatSessionDate(getBookingDateValue(booking))}</Text>
                <Text style={styles.bookingMeta}>{booking.session_time || 'Time TBD'} • {formatPrice(booking.total_price || booking.price)}</Text>
                <Text style={styles.bookingMeta}>{formatBookingLocation(booking)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardCopy}>No bookings available yet.</Text>
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

function AdminUsersScreen({ users, total, loading, errorMessage, onBack, onRefresh }) {
  return (
    <ScrollView contentContainerStyle={styles.signInScrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.signInHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.signInCardDark}>
        <Text style={styles.sectionEyebrow}>Users (All)</Text>
        <Text style={styles.signInTitleDark}>All registered users</Text>
        <Text style={styles.signInSubtitleDark}>Review every account currently registered in the platform from the native app.</Text>

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
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Accounts</Text>
                <Text style={styles.statValue}>{overview?.users?.total_accounts || 0}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Open Cases</Text>
                <Text style={styles.statValue}>{overview?.operations?.open_cases || 0}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Open Disputes</Text>
                <Text style={styles.statValue}>{overview?.operations?.open_disputes || 0}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Deletion Requests</Text>
                <Text style={styles.statValue}>{overview?.operations?.pending_deletion_requests || 0}</Text>
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
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent cases</Text>
                <View style={styles.recipientToggleRow}>
                  {adminCaseFilterOptions.map((status) => (
                    <Pressable
                      key={`case-filter-${status}`}
                      onPress={() => onCaseFilterChange(status)}
                      style={[styles.recipientToggle, caseFilter === status && styles.recipientToggleActive]}
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
                <View style={styles.recipientToggleRow}>
                  {adminDisputeFilterOptions.map((status) => (
                    <Pressable
                      key={`dispute-filter-${status}`}
                      onPress={() => onDisputeFilterChange(status)}
                      style={[styles.recipientToggle, disputeFilter === status && styles.recipientToggleActive]}
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

                <View style={styles.recipientToggleRow}>
                  {adminVerificationFilterOptions.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => onVerificationFilterChange(status)}
                      style={[styles.recipientToggle, verificationFilter === status && styles.recipientToggleActive]}
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
            </View>
          </>
        )}
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
  onOpenAdminVerifications,
  onOpenAdminAuditLogs,
  onOpenAdminOperations,
  onOpenAdminHelp,
  onOpenCoachOperations,
  onSignOut,
}) {
  const accountType = normalizeUserType(profile?.user_type || currentUser?.user_type || 'client');
  const displayName = profile?.full_name || currentUser?.full_name || currentUser?.email || 'FACT user';
  const resolvedDashboard = dashboard || buildDashboardState(accountType, {});

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
            <Text style={styles.brandText}>FACT Mobile</Text>
          </View>

          <Text style={styles.eyebrow}>Native session active</Text>
          <Text style={styles.title}>Welcome back, {displayName}.</Text>
          <Text style={styles.subtitle}>
            You are signed in as {accountType}. Native login is working, and this screen now reflects your role instead of dropping straight into the browser.
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.sectionHeaderCompact}>
          <Text style={styles.sectionEyebrow}>{resolvedDashboard.eyebrow}</Text>
          <Text style={styles.sectionTitle}>{resolvedDashboard.heading}</Text>
          <Text style={styles.sectionSubtitle}>{resolvedDashboard.subheading}</Text>
        </View>

        <View style={styles.featureGrid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.cardCopy}>{currentUser?.email}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Role</Text>
            <Text style={styles.cardCopy}>{accountType}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Session</Text>
            <Text style={styles.cardCopy}>{loadingProfile ? 'Refreshing profile...' : 'Signed in on device'}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {resolvedDashboard.stats.map((item) => {
            const isAccountsCta = accountType === 'admin' && item.label === 'Accounts';

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

            return (
              <View key={item.label} style={styles.statTile}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue}>{item.value}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.spotlightRow}>
          {resolvedDashboard.spotlight.map((item) => (
            <View key={item.label} style={styles.spotlightCard}>
              <Text style={styles.spotlightLabel}>{item.label}</Text>
              <Text style={styles.spotlightValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeaderCompact}>
          <Text style={styles.sectionEyebrow}>{resolvedDashboard.bookingsTitle}</Text>
          {dashboardLoading ? <Text style={styles.sectionSubtitle}>Refreshing native dashboard data...</Text> : null}
          {dashboardError ? <Text style={styles.errorText}>{dashboardError}</Text> : null}
        </View>

        {dashboardLoading ? (
          <View style={styles.dashboardLoadingRow}>
            <ActivityIndicator color="#f59e0b" />
            <Text style={styles.cardCopy}>Loading your dashboard</Text>
          </View>
        ) : resolvedDashboard.bookings.length > 0 ? (
          <View style={styles.bookingList}>
            {resolvedDashboard.bookings.slice(0, 5).map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardCopy}>{resolvedDashboard.emptyBookingsText}</Text>
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
          ? { view: 'admin_list', limit: 20, offset: 0, orderBy: '-created_at' }
          : {
              [accountType === 'coach' ? 'coach_id' : 'client_id']: nextUser.id,
              limit: 20,
              offset: 0,
              orderBy: '-booking_date',
            }
      );

      setBookingsViewItems(Array.isArray(response) ? response : response?.data || []);
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

  const syncUpdatedBooking = (updatedBooking) => {
    setSelectedBooking(updatedBooking);
    setBookingsViewItems((previousBookings) => previousBookings.map((booking) => (
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
        {view === 'sign_in' ? (
          <SignInScreen
            email={email}
            password={password}
            errorMessage={errorMessage}
            submitting={submitting}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onBack={() => setView('home')}
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
            onOpenAdminVerifications={() => openAdminOperationsView({
              verificationFilter: 'pending',
              caseFilter: 'all',
              disputeFilter: 'all',
              caseLimit: 5,
              disputeLimit: 5,
              verificationLimit: 6,
            })}
            onOpenAdminAuditLogs={() => openAdminOperationsView({
              verificationFilter: 'all',
              caseFilter: 'all',
              disputeFilter: 'all',
              caseLimit: 5,
              disputeLimit: 5,
              verificationLimit: 6,
            })}
            onOpenAdminOperations={() => openAdminOperationsView({
              verificationFilter: 'pending',
              caseFilter: 'open',
              disputeFilter: 'open',
              caseLimit: 5,
              disputeLimit: 5,
              verificationLimit: 6,
            })}
            onOpenAdminHelp={openMessagesInboxView}
            onOpenCoachOperations={async () => {
              await loadCoachOperations(currentUser, profile);
              setView('coach_operations');
            }}
            onOpenBookings={async () => {
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
                <Text style={styles.brandText}>FACT Mobile</Text>
              </View>

              <Text style={styles.eyebrow}>Find A Coach Today</Text>
              <Text style={styles.title}>Train smarter with expert football coaching.</Text>
              <Text style={styles.subtitle}>
                Discover trusted coaches, manage your account, and move into the first native FACT experience.
              </Text>
            </View>
          </ImageBackground>

          <View style={styles.content}>
            <View style={styles.actionGroup}>
              {primaryActions.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => {
                    if (action.label === 'Sign In') {
                      setEmail('');
                      setPassword('');
                      setErrorMessage('');
                      setView('sign_in');
                      return;
                    }

                    if (action.label === 'Find a Coach') {
                      openHref('https://findacoachtoday.com/findcoaches');
                      return;
                    }

                    openHref('https://findacoachtoday.com/register?type=coach');
                  }}
                  style={({ pressed }) => [
                    styles.actionButton,
                    action.variant === 'primary' && styles.actionButtonPrimary,
                    action.variant === 'secondary' && styles.actionButtonSecondary,
                    action.variant === 'ghost' && styles.actionButtonGhost,
                    pressed && styles.actionButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionTitle,
                      action.variant === 'secondary' && styles.actionTitleSecondary,
                      action.variant === 'ghost' && styles.actionTitleGhost,
                    ]}
                  >
                    {action.label}
                  </Text>
                  <Text
                    style={[
                      styles.actionBody,
                      action.variant === 'secondary' && styles.actionBodySecondary,
                      action.variant === 'ghost' && styles.actionBodyGhost,
                    ]}
                  >
                    {action.description}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Why FACT</Text>
              <Text style={styles.sectionTitle}>A stronger first screen than the placeholder shell</Text>
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
    minHeight: 420,
    justifyContent: 'flex-end',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    minHeight: 420,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    backgroundColor: 'rgba(6, 14, 28, 0.68)',
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
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  actionButtonSecondary: {
    backgroundColor: '#0f172a',
    borderColor: '#1d4ed8',
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
    color: '#08111f',
    fontSize: 18,
    fontWeight: '800',
  },
  actionTitleGhost: {
    color: '#f8fafc',
  },
  actionTitleSecondary: {
    color: '#f8fafc',
  },
  actionBody: {
    color: 'rgba(8, 17, 31, 0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
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
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 44,
    maxWidth: 320,
  },
  subtitle: {
    color: '#dbe4f3',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 340,
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
    gap: 12,
    marginBottom: 14,
  },
  statTile: {
    backgroundColor: '#0f172a',
    borderColor: '#1d4ed8',
    borderRadius: 18,
    borderWidth: 1,
    minWidth: '47%',
    padding: 16,
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
  recipientToggle: {
    backgroundColor: '#0f172a',
    borderColor: '#243041',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  bookingStatus: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
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
});