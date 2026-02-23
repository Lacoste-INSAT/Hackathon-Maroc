// ─────────────────────────────────────────────────────────────
// Snap & Sync — Dashboard Screen (Corporate Trust)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect, Filter, FeGaussianBlur } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, borderRadius } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useSyncStore } from '@/stores/useSyncStore';
import { getSessionsByDate } from '@/services/sessionRepository';
import { getQueueStats } from '@/services/offlineQueue';
import { getDatabase } from '@/services/database';
import { ActiveSession } from '@/components/ActiveSession';

// ── Helpers ──────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Background Orbs ──────────────────────────────────────────

const { width, height } = Dimensions.get('window');

function BackgroundOrbs() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]} pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <RadialGradient id="grad1" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="rgba(79, 70, 229, 0.015)" />
            <Stop offset="100%" stopColor="rgba(79, 70, 229, 0)" />
          </RadialGradient>
          <RadialGradient id="grad2" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="rgba(124, 58, 237, 0.01)" />
            <Stop offset="100%" stopColor="rgba(124, 58, 237, 0)" />
          </RadialGradient>
        </Defs>
        <Circle cx="0%" cy="0%" r={width * 0.35} fill="url(#grad1)" />
        <Circle cx="100%" cy="15%" r={width * 0.28} fill="url(#grad2)" />
      </Svg>
    </View>
  );
}

// ── Component ────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { isOnline } = useNetworkState();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const activeSessionId = useSyncStore((s) => s.activeSessionId);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  const [todayPatients, setTodayPatients] = useState<number>(0);
  const [pendingSyncs, setPendingSyncs] = useState<number>(0);
  const [avgConfidence, setAvgConfidence] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Data fetching ─────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const sessions = await getSessionsByDate(getTodayStr());
      setTodayPatients(sessions.length);

      const stats = await getQueueStats();
      setPendingSyncs(stats.pendingCount);

      const db = getDatabase();
      const row = await db.getFirstAsync<{ avg: number | null }>(
        `SELECT AVG(overall_confidence) as avg FROM records WHERE overall_confidence IS NOT NULL`,
        []
      );
      setAvgConfidence(row?.avg ? Math.round(row.avg) : 0);
    } catch (err) {
      console.error('[Dashboard] Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  // ── Render ────────────────────────────────────────────────

  if (activeSessionId) {
    return <ActiveSession sessionId={activeSessionId} />;
  }

  return (
    <View style={styles.screen}>
      <BackgroundOrbs />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text weight="SemiBold" style={styles.greeting}>
              {getGreeting()},
            </Text>
            <Text weight="Bold" style={styles.doctorName}>Dr. Benali</Text>
            <Text weight="Medium" style={styles.subtitle}>CHU Rural Clinic — Tizi Ouzou</Text>
          </View>

          {/* Sync status indicator */}
          <View style={styles.syncIndicator}>
            {syncStatus === 'syncing' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? colors.success : colors.mutedForeground },
                ]}
              />
            )}
            <Text weight="SemiBold" style={styles.syncLabel}>
              {syncStatus === 'syncing'
                ? 'Syncing…'
                : isOnline
                ? 'Online'
                : 'Offline'}
            </Text>
          </View>
        </View>

        {/* ── Offline Warning ────────────────────────────────── */}
        {!isOnline && (
          <Card variant="warning" style={styles.offlineCard}>
            <CardContent style={styles.offlineContent}>
              <View style={styles.offlineRow}>
                <Ionicons name="cloud-offline-outline" size={24} color={colors.warning} />
                <View style={styles.offlineText}>
                  <Text weight="Bold" style={styles.offlineTitle}>You're Offline</Text>
                  <Text style={styles.offlineDesc}>
                    Photos are saved locally and will auto-sync when connection is restored.
                    {pendingSyncs > 0
                      ? ` ${pendingSyncs} item${pendingSyncs > 1 ? 's' : ''} queued.`
                      : ''}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* ── Start Session Button ───────────────────────────── */}
        <View style={styles.isometricContainer}>
          <Button
            onPress={() => {
              router.push('/session/new');
            }}
            variant="primary"
            size="xl"
            style={styles.startButton}
            icon={
              <Ionicons
                name="camera"
                size={22}
                color={colors.primaryForeground}
              />
            }
          >
            Start New Session
          </Button>
        </View>

        {/* ── Stats Row ──────────────────────────────────────── */}
        <Text weight="Bold" style={styles.sectionTitle}>Today's Overview</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginVertical: spacing.xxl }}
          />
        ) : (
          <View style={styles.statsRow}>
            {/* Today's Patients */}
            <Card style={styles.statCard} variant="default">
              <CardContent style={styles.statContent}>
                <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="people" size={22} color={colors.primary} />
                </View>
                <Text weight="ExtraBold" style={styles.statNumber}>{todayPatients}</Text>
                <Text weight="SemiBold" style={styles.statLabel}>Patients{'\n'}Today</Text>
              </CardContent>
            </Card>

            {/* Pending Syncs */}
            <Card style={styles.statCard} variant="default">
              <CardContent style={styles.statContent}>
                <View
                  style={[
                    styles.statIcon,
                    {
                      backgroundColor:
                        pendingSyncs > 0 ? colors.warningLight : colors.primaryLight,
                    },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload"
                    size={20}
                    color={pendingSyncs > 0 ? colors.warning : colors.primary}
                  />
                </View>
                <Text weight="ExtraBold" style={styles.statNumber}>{pendingSyncs}</Text>
                <Text weight="SemiBold" style={styles.statLabel}>Pending{'\n'}Syncs</Text>
              </CardContent>
            </Card>

            {/* AI Accuracy */}
            <Card style={styles.statCard} variant="default">
              <CardContent style={styles.statContent}>
                <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                </View>
                <Text weight="ExtraBold" style={styles.statNumber}>
                  {avgConfidence > 0 ? `${avgConfidence}%` : '—'}
                </Text>
                <Text weight="SemiBold" style={styles.statLabel}>AI{'\n'}Accuracy</Text>
              </CardContent>
            </Card>
          </View>
        )}

        {/* ── Last Sync Info ─────────────────────────────────── */}
        <View style={styles.lastSyncRow}>
          <Ionicons name="sync" size={14} color={colors.mutedForeground} />
          <Text weight="Medium" style={styles.lastSyncText}>
            Last sync: {formatRelativeTime(lastSyncAt)}
          </Text>
          {pendingCount > 0 && (
            <Badge variant="warning" style={styles.pendingBadge}>
              {`${pendingCount} in queue`}
            </Badge>
          )}
        </View>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <Text weight="Bold" style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <Button
            onPress={() => router.push('/history')}
            variant="outline"
            size="md"
            style={styles.actionButton}
            icon={<Ionicons name="time-outline" size={18} color={colors.foreground} />}
          >
            View History
          </Button>
          <Button
            onPress={() => router.push('/queue')}
            variant="outline"
            size="md"
            style={styles.actionButton}
            icon={
              <Ionicons
                name="list"
                size={18}
                color={colors.foreground}
              />
            }
          >
            Review Queue
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    color: colors.foreground,
    lineHeight: 28,
  },
  doctorName: {
    color: colors.foreground,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: -4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },

  // Sync indicator
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Offline warning
  offlineCard: {
    marginBottom: spacing.lg,
  },
  offlineContent: {
    paddingVertical: spacing.md,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  offlineText: {
    flex: 1,
  },
  offlineTitle: {
    fontSize: 15,
    color: colors.warningForeground,
    marginBottom: 2,
  },
  offlineDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },

  // Container
  isometricContainer: {
    marginTop: spacing.xl,
    marginBottom: 32,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderRadius: borderRadius.md,
  },
  startButton: {
    borderRadius: borderRadius.md,
  },

  // Section title
  sectionTitle: {
    fontSize: 22,
    color: colors.foreground,
    lineHeight: 28,
    marginBottom: spacing.md,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statNumber: {
    fontSize: 24,
    color: colors.foreground,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Last sync
  lastSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  lastSyncText: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  pendingBadge: {
    marginLeft: 'auto',
  },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
