import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { normalizeUserType } from '@fact/domain';

const architecturePillars = [
  'Shared domain logic',
  'Shared API transport',
  'Shared auth session core',
  'Native-first shell',
];

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <Text style={styles.eyebrow}>FACT Mobile</Text>
          <Text style={styles.title}>Native shell is live in the monorepo.</Text>
          <Text style={styles.subtitle}>
            This app is wired to the shared packages and ready for the first mobile auth and API screens.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shared package check</Text>
            <Text style={styles.cardCopy}>
              normalizeUserType('coach') = <Text style={styles.cardValue}>{normalizeUserType('coach')}</Text>
            </Text>
          </View>

          <View style={styles.list}>
            {architecturePillars.map((item) => (
              <View key={item} style={styles.listRow}>
                <View style={styles.dot} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08111f',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    backgroundColor: '#08111f',
  },
  eyebrow: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 420,
  },
  card: {
    marginTop: 28,
    backgroundColor: '#0f172a',
    borderColor: '#1e3a8a',
    borderWidth: 1,
    borderRadius: 18,
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
  cardValue: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  list: {
    marginTop: 28,
    gap: 12,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#f59e0b',
    marginRight: 12,
  },
  listText: {
    color: '#e2e8f0',
    fontSize: 16,
  },
});