// ─────────────────────────────────────────────────────────────
// Snap & Sync — History Screen (Task 1.4 + 5.4 data wiring)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
  getConfidenceColor,
  getConfidenceBg,
} from '@/lib/theme';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getDatabase } from '@/services/database';
import type { HistoryEntry, HistoryStatus } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────

/** Map a raw DB row into a display-ready HistoryStatus */
function deriveStatus(
  recordStatus: string,
  hasCorrections: boolean
): HistoryStatus {
  if (recordStatus === 'approved' && hasCorrections) return 'doctor-reviewed';
  if (recordStatus === 'approved') return 'ai-realtime';
  return 'auto-synced';
}

/** Human-readable label for a HistoryStatus */
function statusLabel(status: HistoryStatus): string {
  switch (status) {
    case 'ai-realtime':
      return 'AI Verified';
    case 'auto-synced':
      return 'Pending Sync';
    case 'doctor-reviewed':
      return 'Doctor Reviewed';
  }
}

/** Badge variant for a HistoryStatus */
function statusVariant(
  status: HistoryStatus
): 'success' | 'warning' | 'default' {
  switch (status) {
    case 'ai-realtime':
      return 'success';
    case 'auto-synced':
      return 'warning';
    case 'doctor-reviewed':
      return 'default';
  }
}

/** Format ISO timestamp to "HH:MM" */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Get initials from patient name */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Raw DB row type (before mapping) ────────────────────────

interface RawHistoryRow {
  id: string;
  patient_name: string | null;
  patient_code: string;
  created_at: string;
  record_status: string;
  overall_confidence: number | null;
  has_corrections: number; // 0 or 1 from SQLite
  notes_count: number;
}

// ── Data fetching ───────────────────────────────────────────

async function fetchHistory(): Promise<HistoryEntry[]> {
  const db = getDatabase();

  const rows = await db.getAllAsync<RawHistoryRow>(
    `SELECT
       r.id,
       s.patient_name,
       s.patient_code,
       r.created_at,
       r.status AS record_status,
       r.overall_confidence,
       CASE WHEN r.doctor_corrections IS NOT NULL THEN 1 ELSE 0 END AS has_corrections,
       (SELECT COUNT(*) FROM records r2 WHERE r2.session_id = s.id) AS notes_count
     FROM records r
     JOIN sessions s ON r.session_id = s.id
     ORDER BY r.created_at DESC
     LIMIT 100`
  );

  return rows.map((row, idx) => ({
    id: idx,
    patient: row.patient_name ?? row.patient_code,
    patientId: row.patient_code,
    time: formatTime(row.created_at),
    notesCount: row.notes_count,
    status: deriveStatus(row.record_status, row.has_corrections === 1),
    confidence: row.overall_confidence ?? 0,
  }));
}

/** Compute summary counts from history entries */
function computeSummary(entries: HistoryEntry[]) {
  let aiRealtime = 0;
  let autoSynced = 0;
  let doctorReviewed = 0;

  for (const e of entries) {
    if (e.status === 'ai-realtime') aiRealtime++;
    else if (e.status === 'auto-synced') autoSynced++;
    else if (e.status === 'doctor-reviewed') doctorReviewed++;
  }

  return { aiRealtime, autoSynced, doctorReviewed };
}

// ── Component ───────────────────────────────────────────────

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchHistory();
      setEntries(data);
    } catch (err) {
      console.error('[History] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const summary = computeSummary(entries);

  // ── List item renderer ────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: HistoryEntry }) => {
      const confColor = getConfidenceColor(item.confidence);
      const confBg = getConfidenceBg(item.confidence);

      return (
        <Card style={styles.listItem}>
          <CardContent style={styles.listItemContent}>
            {/* Patient avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(item.patient)}
              </Text>
            </View>

            {/* Patient info */}
            <View style={styles.patientInfo}>
              <Text style={styles.patientName} numberOfLines={1}>
                {item.patient}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={colors.mutedForeground}
                />
                <Text style={styles.metaText}>{item.time}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons
                  name="document-text-outline"
                  size={12}
                  color={colors.mutedForeground}
                />
                <Text style={styles.metaText}>
                  {item.notesCount} note{item.notesCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Status + Confidence */}
            <View style={styles.rightCol}>
              <Badge variant={statusVariant(item.status)}>
                {statusLabel(item.status)}
              </Badge>
              {item.confidence > 0 && (
                <View
                  style={[
                    styles.confidencePill,
                    {
                      backgroundColor: confBg.bg,
                      borderColor: confBg.border,
                    },
                  ]}
                >
                  <Text style={[styles.confidenceText, { color: confBg.text }]}>
                    {item.confidence}%
                  </Text>
                </View>
              )}
            </View>
          </CardContent>
        </Card>
      );
    },
    []
  );

  // ── Empty state ───────────────────────────────────────────

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="document-text-outline"
          size={56}
          color={colors.border}
        />
        <Text style={styles.emptyTitle}>No Records Yet</Text>
        <Text style={styles.emptyDesc}>
          Start a new session to capture patient documents.{'\n'}They'll appear
          here automatically.
        </Text>
      </View>
    );
  };

  // ── Header component (rendered above FlatList) ────────────

  const ListHeader = () => (
    <View>
      {/* ── Page Header ──────────────────────────────────── */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {entries.length > 0
            ? `${entries.length} record${entries.length !== 1 ? 's' : ''} captured`
            : "Today's session records"}
        </Text>
      </View>

      {/* ── Summary Cards ────────────────────────────────── */}
      <View style={styles.summaryRow}>
        <SummaryCard
          icon="sparkles"
          label="AI Verified"
          count={summary.aiRealtime}
          color={colors.success}
          bg={colors.successLight}
        />
        <SummaryCard
          icon="cloud-upload-outline"
          label="Auto-synced"
          count={summary.autoSynced}
          color={colors.warning}
          bg={colors.warningLight}
        />
        <SummaryCard
          icon="checkmark-circle-outline"
          label="Reviewed"
          count={summary.doctorReviewed}
          color={colors.primary}
          bg={colors.primaryLight}
        />
      </View>

      {/* ── Status Legend ─────────────────────────────────── */}
      <View style={styles.legendRow}>
        <LegendPill color={colors.success} label="AI Verified" />
        <LegendPill color={colors.warning} label="Pending Sync" />
        <LegendPill color={colors.primary} label="Doctor Reviewed" />
      </View>
    </View>
  );

  // ── Main render ───────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading records…</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.listContent}
      data={entries}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={renderEmpty}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

// ── Sub-components ──────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  count,
  color,
  bg,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <Card style={styles.summaryCard}>
      <CardContent style={styles.summaryCardContent}>
        <View style={[styles.summaryIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.summaryCount}>{count}</Text>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {label}
        </Text>
      </CardContent>
    </Card>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendPill}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  listContent: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  // Header
  headerSection: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },

  // Summary cards
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
  },
  summaryCardContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryCount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'center',
  },

  // Status legend
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
  },

  // List items
  listItem: {
    marginBottom: 0,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  separator: {
    height: spacing.sm,
  },

  // Avatar
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  // Patient info
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  metaDot: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginHorizontal: 2,
  },

  // Right column
  rightCol: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  confidencePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyDesc: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xxl,
  },
});
