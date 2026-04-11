import React from 'react';
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { normalizeUserType } from '@fact/domain';

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
    description: 'Access bookings, messages, and your dashboard.',
    href: 'https://findacoachtoday.com/login',
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

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />
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
                  onPress={() => openHref(action.href)}
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08111f',
  },
  scrollContent: {
    paddingBottom: 32,
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