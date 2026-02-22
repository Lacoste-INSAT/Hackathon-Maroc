// ─────────────────────────────────────────────────────────────
// Snap & Sync — Dashboard Screen (Task 1.3 + 5.4 data wiring)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
} from '@/lib/theme';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useSyncStore } from '@/stores/useSyncStore';
import { getSessionsByDate } from '@/services/sessionRepository';
import { getQueueStats } from '@/services/offlineQueue';
import { getDatabase } from '@/services/database';

// ── Helpers ──────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
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

// ── Component ────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { isOnline } = useNetworkState();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  const [todayPatients, setTodayPatients] = useState<number>(0);
  const [pendingSyncs, setPendingSyncs] = useState<number>(0);
  const [avgConfidence, setAvgConfidence] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Data fetching ─────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      // Today's sessions → patient count
      const sessions = await getSessionsByDate(getTodayStr());
      setTodayPatients(sessions.length);

      // Pending sync count from queue
      const stats = await getQueueStats();
      setPendingSyncs(stats.pendingCount);

      // Average AI confidence from all records with a confidence value
      const db = getDatabase();
      const row = await db.getFirstAsync<{ avg: number | null }>(
        `SELECT AVG(overall_confidence) as avg FROM records WHERE overall_confidence IS NOT NULL`
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

  return (
    <ScrollView
      style={styles.screen}
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
          <Text style={styles.greeting}>
            {getGreeting()}, <Text style={styles.doctorName}>Dr. Benali</Text>
          </Text>
          <Text style={styles.subtitle}>CHU Rural Clinic — Tizi Ouzou</Text>
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
          <Text style={styles.syncLabel}>
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
              <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
              <View style={styles.offlineText}>
                <Text style={styles.offlineTitle}>You're Offline</Text>
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
      <Button
        onPress={() => {
          router.push('/capture');
        }}
        variant="primary"
        size="xl"
        style={styles.startButton}
        icon={
          <Ionicons
            name="camera-outline"
            size={24}
            color={colors.primaryForeground}
          />
        }
      >
        Start New Session
      </Button>

      {/* ── Stats Row ──────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Today's Overview</Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginVertical: spacing.xxl }}
        />
      ) : (
        <View style={styles.statsRow}>
          {/* Today's Patients */}
          <Card style={styles.statCard} variant="primary">
            <CardContent style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statNumber}>{todayPatients}</Text>
              <Text style={styles.statLabel}>Patients{'\n'}Today</Text>
            </CardContent>
          </Card>

          {/* Pending Syncs */}
          <Card
            style={styles.statCard}
            variant={pendingSyncs > 0 ? 'warning' : 'default'}
          >
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
                  name="cloud-upload-outline"
                  size={20}
                  color={pendingSyncs > 0 ? colors.warning : colors.primary}
                />
              </View>
              <Text style={styles.statNumber}>{pendingSyncs}</Text>
              <Text style={styles.statLabel}>Pending{'\n'}Syncs</Text>
            </CardContent>
          </Card>

          {/* AI Accuracy */}
          <Card style={styles.statCard} variant="success">
            <CardContent style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="sparkles-outline" size={20} color={colors.success} />
              </View>
              <Text style={styles.statNumber}>
                {avgConfidence > 0 ? `${avgConfidence}%` : '—'}
              </Text>
              <Text style={styles.statLabel}>AI{'\n'}Accuracy</Text>
            </CardContent>
          </Card>
        </View>
      )}

      {/* ── Last Sync Info ─────────────────────────────────── */}
      <View style={styles.lastSyncRow}>
        <Ionicons name="sync-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.lastSyncText}>
          Last sync: {formatRelativeTime(lastSyncAt)}
        </Text>
        {pendingCount > 0 && (
          <Badge variant="warning" style={styles.pendingBadge}>
            {`${pendingCount} in queue`}
          </Badge>
        )}
      </View>

      {/* ── Quick Actions ──────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
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
              name="git-pull-request-outline"
              size={18}
              color={colors.foreground}
            />
          }
        >
          Review Queue
        </Button>
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
    lineHeight: 32,
  },
  doctorName: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },

  // Sync indicator
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
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
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.warningForeground,
    marginBottom: 2,
  },
  offlineDesc: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },

  // Start button
  startButton: {
    marginBottom: spacing.xxl,
    borderRadius: borderRadius.lg,
  },

  // Section title
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
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
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statNumber: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Last sync
  lastSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: borderRadius.sm,
  },
  lastSyncText: {
    fontSize: fontSize.sm,
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
  },
});
