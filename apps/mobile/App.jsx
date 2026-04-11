import React, { useEffect, useState } from 'react';
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
import { getCurrentProfile, mobileApi, mobileAuth, signInWithEmail, signOut } from './src/lib/mobileAuth';

const factIcon = require('./assets/icon.png');

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
    variant: 'secondary',
  },
  {
    label: 'Become a Coach',
    description: 'Create a coach profile and start receiving bookings.',
    href: 'https://findacoachtoday.com/register?type=coach',
    variant: 'ghost',
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
      ],
      bookings,
      bookingsTitle: 'Recent bookings',
      emptyBookingsText: 'No bookings available yet.',
      primaryLink: { label: 'Open Admin Dashboard', href: 'https://findacoachtoday.com/admindashboard' },
      secondaryLink: { label: 'Open Admin Operations', href: 'https://findacoachtoday.com/adminoperations' },
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
      primaryLink: { label: 'Open Coach Dashboard', href: 'https://findacoachtoday.com/coachdashboard' },
      secondaryLink: { label: 'Open Messages', href: 'https://findacoachtoday.com/messages' },
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
    primaryLink: { label: 'Open My Bookings', href: 'https://findacoachtoday.com/mybookings' },
    secondaryLink: { label: 'Browse Coaches', href: 'https://findacoachtoday.com/findcoaches' },
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

function BookingDetailScreen({ booking, onBack, onOpenMessages }) {
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

        <View style={styles.actionGroupSignedIn}>
          <Pressable onPress={onOpenMessages} style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}>
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Open messages on web</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Conversation UI is still web-based for now.</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function AuthenticatedHome({ currentUser, profile, loadingProfile, dashboardLoading, dashboardError, dashboard, onRefresh, onOpenBookings, onSignOut }) {
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
            <Image source={factIcon} style={styles.logo} />
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

        <View style={styles.statsGrid}>
          {resolvedDashboard.stats.map((item) => (
            <View key={item.label} style={styles.statTile}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
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
          <Pressable
            onPress={onOpenBookings}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.actionTitle}>Open native bookings</Text>
            <Text style={styles.actionBody}>Stay in the app for booking lists and booking detail.</Text>
          </Pressable>

          <Pressable
            onPress={() => openHref(resolvedDashboard.primaryLink.href)}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>{resolvedDashboard.primaryLink.label}</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Use the web dashboard only for the deeper tools that have not been migrated yet.</Text>
          </Pressable>

          <Pressable
            onPress={() => openHref(resolvedDashboard.secondaryLink.href)}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>{resolvedDashboard.secondaryLink.label}</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Keep moving inside the product while the native experience expands.</Text>
          </Pressable>

          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Refresh dashboard</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Pull the latest stats and bookings from the live API.</Text>
          </Pressable>

          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonGhost, pressed && styles.actionButtonPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleGhost]}>Sign out</Text>
            <Text style={[styles.actionBody, styles.actionBodyGhost]}>Clear the local session on this device.</Text>
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
            <Image source={factIcon} style={styles.logoCompact} />
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
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={onEmailChange}
              placeholder="name@example.com"
              placeholderTextColor="#64748b"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={onPasswordChange}
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              secureTextEntry={true}
              style={styles.input}
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
    setBookingsViewItems([]);
    setBookingsViewError('');
    setSelectedBooking(null);
    setView('home');
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
        ) : view === 'booking_detail' && selectedBooking ? (
          <BookingDetailScreen
            booking={selectedBooking}
            onBack={() => setView('bookings')}
            onOpenMessages={() => openHref(`https://findacoachtoday.com/conversation?booking_id=${selectedBooking.id}`)}
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#0f172a',
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
  errorText: {
    color: '#b91c1c',
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
    borderColor: '#1e3a8a',
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
  spotlightRow: {
    gap: 12,
    marginTop: 14,
    marginBottom: 18,
  },
  spotlightCard: {
    backgroundColor: '#101826',
    borderRadius: 18,
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
  bookingList: {
    gap: 12,
    marginBottom: 10,
  },
  bookingListLarge: {
    gap: 12,
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
});