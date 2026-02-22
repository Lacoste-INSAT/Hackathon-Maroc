// ─────────────────────────────────────────────────────────────
// Snap & Sync — Root Layout (Production)
// ─────────────────────────────────────────────────────────────
//
// Responsibilities:
//   1. Initialize SQLite database on app launch
//   2. Start the background sync worker AFTER DB is ready
//   3. Wrap the entire tree in NetworkProvider for offline detection
//   4. Never block UI rendering — DB init is async & fast
//
// Provider hierarchy:
//   <NetworkProvider>
//     <StatusBar />
//     <Stack>
//       <(tabs) />
//     </Stack>
//   </NetworkProvider>
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { NetworkProvider } from '@/contexts/NetworkContext';
import { initDatabase } from '@/services/database';
import { ensureSession } from '@/services/auth';
import { startSyncWorker } from '@/services/backgroundSync';
import { getQueueStats } from '@/services/offlineQueue';
import { useSyncStore } from '@/stores/useSyncStore';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const stopWorkerRef = useRef<(() => void) | null>(null);

  // ── Step 1: Initialize SQLite & Auth ───────────────────────
  const initializeApp = useCallback(async () => {
    try {
      await ensureSession();
      console.log('[RootLayout] Auth session ensured');
      await initDatabase();
      setIsDbReady(true);
      console.log('[RootLayout] Database initialized');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[RootLayout] DB init failed:', msg);
      setInitError(msg);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // ── Step 2: Start background sync AFTER DB is ready ────────
  useEffect(() => {
    if (!isDbReady) return;

    // Hydrate the Zustand store with current queue stats
    getQueueStats()
      .then((stats) => {
        useSyncStore.getState().setPendingCount(stats.pendingCount);
      })
      .catch((err) => {
        console.warn('[RootLayout] Failed to hydrate queue stats:', err);
      });

    // Start the sync worker — it listens for network changes
    // and auto-syncs when connectivity is restored
    const stopWorker = startSyncWorker();
    stopWorkerRef.current = stopWorker;

    console.log('[RootLayout] Background sync worker started');

    return () => {
      stopWorkerRef.current?.();
      stopWorkerRef.current = null;
      console.log('[RootLayout] Background sync worker cleaned up');
    };
  }, [isDbReady]);

  // Hide splash screen once database is fully ready
  useEffect(() => {
    if (isDbReady) {
      SplashScreen.hideAsync();
    }
  }, [isDbReady]);

  // ── Step 3: Render ─────────────────────────────────────────

  // Fatal init error — show a recovery message
  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Database Error</Text>
        <Text style={styles.errorMessage}>
          The local database failed to initialize. Please restart the app.
        </Text>
        <Text style={styles.errorDetail}>{initError}</Text>
      </View>
    );
  }

  // DB still initializing — return null to prevent router tree evaluation
  // expo-router handles splash screen hiding automatically when the first layout mounts,
  // but since we are delaying it here, we should ensure the tree isn't evaluated.
  if (!isDbReady) {
    return null;
  }

  // ── App is ready — render with providers ───────────────────
  return (
    <NetworkProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NetworkProvider>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 16,
  },
  splashText: {
    fontSize: 16,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.destructive,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.foreground,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
