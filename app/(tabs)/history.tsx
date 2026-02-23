// ─────────────────────────────────────────────────────────────
// Snap & Sync — History Screen (Task 1.4 + 5.4 data wiring)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
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
  getConfidenceColor,
  getConfidenceBg,
} from '@/lib/theme';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/Text';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { getDatabase } from '@/services/database';
import { formatName, formatCode } from '@/lib/stringUtils';
import type { HistoryEntry, HistoryStatus } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────

/** Map a raw DB row into a display-ready HistoryStatus */
function deriveStatus(
  recordStatus: string,
  hasCorrections: boolean,
  confidence: number,
  correctionsJson: string | null
): HistoryStatus {
  if (recordStatus !== 'approved') return 'pending-sync';
  
  if (!correctionsJson) {
    if (confidence < 80) return 'queue-reviewed';
    return 'ai-verified';
  }
  
  try {
    const parsed = JSON.parse(correctionsJson);
    const hasEdits = parsed.some((p: any) => p.originalValue !== p.correctedValue);
    
    if (hasEdits) return 'assisted-capture';
    if (confidence < 80) return 'queue-reviewed';
    return 'autocaptured';
  } catch(e) {
    if (confidence < 80) return 'queue-reviewed';
    return 'ai-verified';
  }
}

/** Human-readable label for a HistoryStatus */
function statusLabel(status: HistoryStatus): string {
  switch (status) {
    case 'ai-verified': return 'AI Verified';
    case 'autocaptured': return 'Autocaptured';
    case 'assisted-capture': return 'Assisted Capture';
    case 'queue-reviewed': return 'Queue-Reviewed';
    case 'pending-sync': return 'Pending Sync';
    default: return 'Pending Sync';
  }
}

/** Define Custom Colors for History Statuses */
function getStatusColors(status: HistoryStatus) {
  switch (status) {
    case 'ai-verified':
      return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.2)', text: '#10B981' };
    case 'autocaptured':
      return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.2)', text: '#3B82F6' };
    case 'assisted-capture':
      return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B' };
    case 'queue-reviewed':
      return { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.2)', text: '#8B5CF6' };
    case 'pending-sync':
    default:
      return { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.2)', text: '#64748B' };
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
  doctor_corrections: string | null;
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
       r.doctor_corrections,
       (SELECT COUNT(*) FROM records r2 WHERE r2.session_id = s.id) AS notes_count
     FROM records r
     JOIN sessions s ON r.session_id = s.id
     ORDER BY r.created_at DESC
     LIMIT 100`,
    []
  );

  return rows.map((row) => {
    const fn = formatName(row.patient_name);
    const fc = formatCode(row.patient_code);
    return {
      id: row.id,
      patient: fn !== 'Unknown Patient' ? fn : (fc !== '—' ? fc : 'Unknown Patient'),
      patientId: fc,
      time: formatTime(row.created_at),
      notesCount: row.notes_count,
      status: deriveStatus(row.record_status, false, row.overall_confidence ?? 0, row.doctor_corrections),
      confidence: row.overall_confidence ?? 0,
    };
  });
}

/** Compute summary counts from history entries */
function computeSummary(entries: HistoryEntry[]) {
  let aiVerified = 0;
  let autocaptured = 0;
  let assistedCapture = 0;
  let queueReviewed = 0;

  for (const e of entries) {
    if (e.status === 'ai-verified') aiVerified++;
    else if (e.status === 'autocaptured') autocaptured++;
    else if (e.status === 'assisted-capture') assistedCapture++;
    else if (e.status === 'queue-reviewed') queueReviewed++;
  }

  return { aiVerified, autocaptured, assistedCapture, queueReviewed };
}

// ── Component ───────────────────────────────────────────────

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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
        <TouchableOpacity 
          onPress={() => {
            router.push(`/record/${item.id}`);
          }}
          activeOpacity={1}
        >
          <Card style={styles.listItem}>
            <CardContent style={styles.listItemContent}>
              {/* Patient avatar */}
              <View style={styles.avatar}>
                <Text weight="Bold" style={styles.avatarText}>
                  {getInitials(item.patient)}
                </Text>
              </View>

              {/* Patient info */}
              <View style={styles.patientInfo}>
                <Text weight="SemiBold" style={styles.patientName} numberOfLines={1}>
                  {item.patient}
                </Text>

                <View style={styles.metaRow}>
                  <Text weight="Medium" style={[styles.metaText, { color: getStatusColors(item.status).text }]}>
                    {statusLabel(item.status)}
                  </Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{item.time}</Text>
                </View>
              </View>

              {/* Action Pill / Confidence */}
              <View style={styles.actionPill}>
                 <CircularProgress value={item.confidence} size={32} strokeWidth={4} showText={true} />
              </View>
            </CardContent>
          </Card>
        </TouchableOpacity>
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
        <Text weight="SemiBold" style={styles.emptyTitle}>No Records Yet</Text>
        <Text style={styles.emptyDesc}>
          Start a new session to capture patient documents.{'\n'}They'll appear
          here automatically.
        </Text>
      </View>
    );
  };

  // ── Header component (rendered above FlatList) ────────────

  const ListHeader = () => (
    <View style={{ paddingTop: spacing.md }}>
      {/* ── Summary Cards ────────────────────────────────── */}
      <View style={styles.summaryRow}>
        <View style={{ flex: 1, flexDirection: 'row', gap: spacing.md }}>
          <SummaryCard
            icon="sparkles"
            label="AI Verified"
            count={summary.aiVerified}
            color="#10B981"
            bg="rgba(16, 185, 129, 0.12)"
          />
          <SummaryCard
            icon="flash-outline"
            label="Autocaptured"
            count={summary.autocaptured}
            color="#3B82F6"
            bg="rgba(59, 130, 246, 0.12)"
          />
          <SummaryCard
            icon="pencil-outline"
            label="Assisted"
            count={summary.assistedCapture}
            color="#F59E0B"
            bg="rgba(245, 158, 11, 0.12)"
          />
          <SummaryCard
            icon="list-outline"
            label="Queue Rev."
            count={summary.queueReviewed}
            color="#8B5CF6"
            bg="rgba(139, 92, 246, 0.12)"
          />
        </View>
      </View>

    </View>
  );

  // ── Main render ───────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text weight="Medium" style={styles.loadingText}>Loading records…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
        <Text weight="Bold" style={styles.title}>History</Text>
        <Text weight="Medium" style={styles.subtitle}>
          {entries.length > 0
            ? `${entries.length} record${entries.length !== 1 ? 's' : ''} captured`
            : "Today's session records"}
        </Text>
      </View>
      <FlatList
        style={styles.flex1}
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
    </View>
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
        <Text weight="Bold" style={styles.summaryCount}>{count}</Text>
        <Text weight="Medium" style={styles.summaryLabel} numberOfLines={1}>
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
      <Text weight="Medium" style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex1: {
    flex: 1,
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
  fixedHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  // Header
  headerSection: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
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
    color: colors.foreground,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
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
    color: colors.primary,
  },

  // Patient info
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: fontSize.md,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
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
  actionPill: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
