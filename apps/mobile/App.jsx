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
import { getCurrentProfile, mobileAuth, signInWithEmail, signOut } from './src/lib/mobileAuth';

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

function AuthenticatedHome({ currentUser, profile, loadingProfile, onSignOut }) {
  const accountType = normalizeUserType(profile?.user_type || currentUser?.user_type || 'client');
  const displayName = profile?.full_name || currentUser?.full_name || currentUser?.email || 'FACT user';
  const isAdmin = accountType === 'admin';

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
            You are signed in as {accountType}. Native login is working; the remaining product areas can move over screen by screen.
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.content}>
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
            <Text style={styles.cardTitle}>Profile status</Text>
            <Text style={styles.cardCopy}>{loadingProfile ? 'Refreshing profile...' : 'Signed in on device'}</Text>
          </View>
        </View>

        <View style={styles.actionGroupSignedIn}>
          <Pressable
            onPress={() => openHref(isAdmin ? 'https://findacoachtoday.com/admindashboard' : 'https://findacoachtoday.com/mybookings')}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonPrimary, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.actionTitle}>Open {isAdmin ? 'Admin Dashboard' : 'My Bookings'}</Text>
            <Text style={styles.actionBody}>Use the web dashboard for the areas that have not been migrated yet.</Text>
          </Pressable>

          <Pressable
            onPress={() => openHref('https://findacoachtoday.com/findcoaches')}
            style={({ pressed }) => [styles.actionButton, styles.actionButtonSecondary, pressed && styles.actionButtonPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleSecondary]}>Browse coaches</Text>
            <Text style={[styles.actionBody, styles.actionBodySecondary]}>Keep exploring coaches while the native experience expands.</Text>
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
              placeholder="support@findacoachtoday.com"
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
            if (active) setProfile(nextProfile);
          } catch {
            if (active) setProfile(null);
          } finally {
            if (active) setProfileLoading(false);
          }
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
        ) : currentUser ? (
          <AuthenticatedHome
            currentUser={currentUser}
            profile={profile}
            loadingProfile={profileLoading}
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
  signInTitle: {
    color: '#08111f',
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