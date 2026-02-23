// ─────────────────────────────────────────────────────────────
// Snap & Sync — Review Queue Screen (Task 1.5 + 5.4 Polish)
// ─────────────────────────────────────────────────────────────
//
// Two sub-views managed by local state:
//   View A — FlatList of records with status === 'needs_review'
//   View B — Detail/Edit: high-res image, editable fields, confidence bars
//
// Polish: expo-haptics, loading skeleton, pull-to-refresh
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  Alert,
  TouchableOpacity,
  type ListRenderItemInfo,
} from 'react-native';
import * as Haptics from 'expo-haptics';
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
import type { Record as DBRecord, ExtractionField, ExtractionResult } from '@/lib/types';
import {
  getNeedsReviewRecords,
  updateRecordCorrections,
  updateRecordStatus,
} from '@/services/recordRepository';
import { getSessionById } from '@/services/sessionRepository';
import { syncAllPending } from '@/services/cloudSync';
import { getFailedItems, retryFailedItem } from '@/services/offlineQueue';
import { debouncedSync } from '@/services/backgroundSync';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/Text';
import { formatName, formatCode } from '@/lib/stringUtils';

// ── Constants ───────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMBNAIL_SIZE = 56;
const SKELETON_COUNT = 4;

// ── Types ───────────────────────────────────────────────────

interface EnrichedRecord extends DBRecord {
  patientName: string;
  patientCode: string;
}

// Map the failed sync item type to display it easily
interface EnrichedFailedItem {
  queueId: number;
  recordId: string;
  patientName: string;
  patientCode: string;
  originalImagePath: string;
  errorMsg: string;
  retryCount: number;
}

interface EditableField extends ExtractionField {
  editedValue: string;
}

// ─────────────────────────────────────────────────────────────
// Main Screen Component
// ─────────────────────────────────────────────────────────────

export default function QueueScreen() {
  // ── State ──
  const [records, setRecords] = useState<EnrichedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<EnrichedRecord | null>(null);
  const [editableFields, setEditableFields] = useState<EditableField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'failed'>('review');
  const [failedItems, setFailedItems] = useState<EnrichedFailedItem[]>([]);
  const [retryingQueueId, setRetryingQueueId] = useState<number | null>(null);

  // ── Data fetching ──

  const fetchRecords = useCallback(async () => {
    try {
      const raw = await getNeedsReviewRecords();

      // Enrich each record with patient info from the session
      const enriched: EnrichedRecord[] = [];
      for (const rec of raw) {
        let patientName = 'Unknown Patient';
        let patientCode = '—';
        try {
          const session = await getSessionById(rec.session_id);
          if (session) {
            patientName = session.patient_name ?? 'Unknown Patient';
            patientCode = session.patient_code;
          }
        } catch {
          // Non-critical — use defaults
        }
        enriched.push({ ...rec, patientName, patientCode });
      }

      setRecords(enriched);

      // Fetch failed queue items
      const failedRaw = await getFailedItems();
      const db = require('@/services/database').getDatabase();
      
      const enrichedFailed: EnrichedFailedItem[] = [];
      for (const item of failedRaw) {
        let patientName = 'Unknown';
        let patientCode = '—';
        let originalImagePath = '';
        
        try {
          const record = await db.getFirstAsync('SELECT * FROM records WHERE id = ?', item.record_id) as DBRecord | null;
          if (record) {
            originalImagePath = record.original_image_path;
            const session = await getSessionById(record.session_id);
            if (session) {
              patientName = formatName(session.patient_name);
              patientCode = formatCode(session.patient_code);
            }
          }
        } catch (e) {}

        enrichedFailed.push({
          queueId: item.id,
          recordId: item.record_id,
          patientName,
          patientCode,
          originalImagePath,
          errorMsg: `Failed after ${item.retry_count} attempts`,
          retryCount: item.retry_count
        });
      }
      setFailedItems(enrichedFailed);

    } catch (err) {
      console.error('[QueueScreen] Failed to fetch records/items:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchRecords();
      setLoading(false);
    })();
  }, [fetchRecords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchRecords();
    setRefreshing(false);
  }, [fetchRecords]);

  // ── Detail navigation ──

  const openDetail = useCallback(
    (record: EnrichedRecord) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Parse extracted fields
      let fields: ExtractionField[] = [];
      if (record.extracted_data) {
        try {
          const parsed: ExtractionResult = JSON.parse(record.extracted_data);
          fields = parsed.fields ?? [];
        } catch {
          // malformed JSON — show empty
        }
      }

      setEditableFields(
        fields.map((f) => ({ ...f, editedValue: f.value }))
      );
      setSelectedRecord(record);
    },
    []
  );

  const closeDetail = useCallback(() => {
    setSelectedRecord(null);
    setEditableFields([]);
  }, []);

  // ── Submit & Verify ──

  const handleSubmit = useCallback(async () => {
    if (!selectedRecord) return;
    setSubmitting(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Build corrections JSON
      const corrections = editableFields.map((f) => ({
        label: f.label,
        originalValue: f.value,
        correctedValue: f.editedValue,
        confidence: f.confidence,
      }));

      // 1. Save corrections & set status to 'approved'
      await updateRecordCorrections(
        selectedRecord.id,
        JSON.stringify(corrections)
      );

      // 2. Fire-and-forget background sync
      syncAllPending().catch((e) =>
        console.warn('[QueueScreen] Background sync error:', e)
      );

      // 3. Re-fetch to get updated list
      const updatedRaw = await getNeedsReviewRecords();

      if (updatedRaw.length === 0) {
        // Queue cleared — celebration haptic
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        setRecords([]);
        setSelectedRecord(null);
        setEditableFields([]);
      } else {
        // Enrich & auto-advance to next item
        const enriched: EnrichedRecord[] = [];
        for (const rec of updatedRaw) {
          let patientName = 'Unknown Patient';
          let patientCode = '—';
          try {
            const session = await getSessionById(rec.session_id);
            if (session) {
              patientName = formatName(session.patient_name);
              patientCode = formatCode(session.patient_code);
            }
          } catch {
            // defaults
          }
          enriched.push({ ...rec, patientName, patientCode });
        }

        setRecords(enriched);

        // Auto-advance to next record
        const next = enriched[0];
        if (next) {
          openDetail(next);
        } else {
          closeDetail();
        }
      }
    } catch (err) {
      console.error('[QueueScreen] Submit error:', err);
      Alert.alert(
        'Error',
        'Failed to submit corrections. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedRecord, editableFields, openDetail, closeDetail]);

  // ── Retry Failed Item ──
  const handleRetryItem = useCallback(async (queueId: number) => {
    setRetryingQueueId(queueId);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await retryFailedItem(queueId);
      setFailedItems((prev) => prev.filter((item) => item.queueId !== queueId));
      debouncedSync(); // trigger background worker to pick it up immediately
    } catch (error) {
      console.error('Failed to retry item:', error);
      Alert.alert('Error', 'Could not retry item.');
    } finally {
      setRetryingQueueId(null);
    }
  }, []);

  // ── Field editing ──

  const updateField = useCallback(
    (index: number, newValue: string) => {
      setEditableFields((prev) =>
        prev.map((f, i) => (i === index ? { ...f, editedValue: newValue } : f))
      );
    },
    []
  );

  // ── Render ──

  if (selectedRecord) {
    return (
      <DetailView
        record={selectedRecord}
        fields={editableFields}
        submitting={submitting}
        onUpdateField={updateField}
        onSubmit={handleSubmit}
        onBack={closeDetail}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text weight="Bold" style={styles.title}>Queue</Text>
        
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'review' && styles.segmentActive]}
            onPress={() => setActiveTab('review')}
            activeOpacity={0.8}
          >
            <Text
              weight={activeTab === 'review' ? 'SemiBold' : 'Medium'}
              style={[
                styles.segmentText,
                activeTab === 'review' ? styles.segmentTextActive : null,
              ]}
            >
              Needs Review ({records.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'failed' && styles.segmentActive]}
            onPress={() => setActiveTab('failed')}
            activeOpacity={0.8}
          >
            <Text
              weight={activeTab === 'failed' ? 'SemiBold' : 'Medium'}
              style={[
                styles.segmentText,
                activeTab === 'failed' ? styles.segmentTextActive : null,
              ]}
            >
              Failed Syncs ({failedItems.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <SkeletonList />
      ) : activeTab === 'review' ? (
        records.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={(info) => (
              <RecordRow item={info.item} onReview={openDetail} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )
      ) : (
        failedItems.length === 0 ? (
          <EmptyState subtitle="No failed syncs." />
        ) : (
          <FlatList
            data={failedItems}
            keyExtractor={(item) => item.queueId.toString()}
            renderItem={({ item }) => (
              <FailedItemRow 
                item={item} 
                onRetry={handleRetryItem} 
                isRetrying={retryingQueueId === item.queueId} 
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sub-Component: Record Row (List Item)
// ─────────────────────────────────────────────────────────────

interface RecordRowProps {
  item: EnrichedRecord;
  onReview: (item: EnrichedRecord) => void;
}

function RecordRow({ item, onReview }: RecordRowProps) {
  const confidence = item.overall_confidence ?? 0;
  const confColors = getConfidenceBg(confidence);
  const badgeVariant =
    confidence >= 90 ? 'success' : confidence >= 75 ? 'default' : 'destructive';

  return (
    <Card style={styles.rowCard}>
      <CardContent style={styles.rowContent}>
        <View style={styles.rowLeft}>
          {/* Thumbnail */}
          <Image
            source={{ uri: item.original_image_path }}
            style={styles.thumbnail}
            resizeMode="cover"
          />

          {/* Patient info */}
          <View style={styles.rowInfo}>
            <Text weight="SemiBold" style={styles.rowPatientName} numberOfLines={1}>
              {item.patientName}
            </Text>
            <Text style={styles.rowPatientCode}>{item.patientCode}</Text>
            <View style={styles.rowBadgeRow}>
              <Badge variant={badgeVariant}>
                {`${Math.round(confidence)}%`}
              </Badge>
              {item.flagged_reason ? (
                <Badge variant="warning">{item.flagged_reason}</Badge>
              ) : null}
            </View>
          </View>
        </View>

        {/* Review button */}
        <Button
          variant="outline"
          size="sm"
          onPress={() => onReview(item)}
          icon={
            <Ionicons
              name="eye-outline"
              size={14}
              color={colors.primary}
            />
          }
          style={{ minWidth: 100 }}
        >
          Review
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sub-Component: Failed Item Row
// ─────────────────────────────────────────────────────────────

function FailedItemRow({
  item,
  onRetry,
  isRetrying,
}: {
  item: EnrichedFailedItem;
  onRetry: (id: number) => void;
  isRetrying: boolean;
}) {
  return (
    <Card style={styles.rowCard}>
      <CardContent style={styles.rowContent}>
        <View style={styles.rowLeft}>
          <Image
            source={{ uri: item.originalImagePath }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          <View style={styles.rowInfo}>
            <Text style={styles.rowPatientName} numberOfLines={1}>
              {item.patientName}
            </Text>
            <Text style={styles.rowPatientCode}>{item.patientCode}</Text>
            <Text style={{ fontSize: 12, color: colors.destructive, marginTop: 4 }} numberOfLines={2}>
              {item.errorMsg}
            </Text>
          </View>
        </View>

        <Button
          variant="outline"
          size="sm"
          onPress={() => onRetry(item.queueId)}
          loading={isRetrying}
          disabled={isRetrying}
          icon={<Ionicons name="refresh-outline" size={14} color={colors.primary} />}
          style={{ minWidth: 100 }}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sub-Component: Detail / Edit View
// ─────────────────────────────────────────────────────────────

interface DetailViewProps {
  record: EnrichedRecord;
  fields: EditableField[];
  submitting: boolean;
  onUpdateField: (index: number, value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function DetailView({
  record,
  fields,
  submitting,
  onUpdateField,
  onSubmit,
  onBack,
}: DetailViewProps) {
  const confidence = record.overall_confidence ?? 0;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.detailHeader}>
        <Button variant="ghost" size="sm" onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          <Text weight="Medium" style={styles.backText}> Back</Text>
        </Button>
        <Badge
          variant={
            confidence >= 90
              ? 'success'
              : confidence >= 75
              ? 'default'
              : 'destructive'
          }
        >
          {`Overall: ${Math.round(confidence)}%`}
        </Badge>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient info header */}
        <View style={styles.detailPatientRow}>
          <View>
            <Text weight="Bold" style={styles.detailPatientName}>{record.patientName}</Text>
            <Text style={styles.detailPatientCode}>{record.patientCode}</Text>
          </View>
          <Text style={styles.detailDate}>
            {new Date(record.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* High-res original image */}
        <Card style={styles.imageCard}>
          <Image
            source={{ uri: record.original_image_path }}
            style={styles.detailImage}
            resizeMode="cover"
          />
        </Card>

        {/* Flagged reason */}
        {record.flagged_reason ? (
          <Card variant="warning" style={styles.flaggedCard}>
            <CardContent style={styles.flaggedContent}>
              <Ionicons
                name="warning-outline"
                size={18}
                color={colors.warning}
              />
              <View style={styles.flaggedTextWrap}>
                <Text weight="SemiBold" style={styles.flaggedLabel}>Flagged Reason</Text>
                <Text style={styles.flaggedText}>
                  {record.flagged_reason}
                </Text>
              </View>
            </CardContent>
          </Card>
        ) : null}

        {/* Extracted data fields */}
        <View style={styles.fieldsSection}>
          <Text weight="Bold" style={styles.fieldsSectionTitle}>Extracted Data</Text>
          <Text style={styles.fieldsSectionSubtitle}>
            Review and correct any fields below
          </Text>

          {fields.length === 0 ? (
            <Card style={styles.noFieldsCard}>
              <CardContent>
                <Text style={styles.noFieldsText}>
                  No extracted data available for this record.
                </Text>
              </CardContent>
            </Card>
          ) : (
            fields.map((field, index) => (
              <FieldEditor
                key={`${field.label}-${index}`}
                field={field}
                index={index}
                onUpdate={onUpdateField}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.detailFooter}>
        <Button
          variant="primary"
          size="xl"
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitButton}
          icon={
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={colors.primaryForeground}
            />
          }
        >
          Submit & Verify
        </Button>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sub-Component: Field Editor (per-field input + confidence bar)
// ─────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: EditableField;
  index: number;
  onUpdate: (index: number, value: string) => void;
}

function FieldEditor({ field, index, onUpdate }: FieldEditorProps) {
  const confColor = getConfidenceColor(field.confidence);
  const confBg = getConfidenceBg(field.confidence);
  const isLow = field.confidence < 75;

  return (
    <Card
      style={[styles.fieldCard, isLow ? styles.fieldCardLow : undefined]}
    >
      <CardContent style={styles.fieldCardContent}>
        {/* Label & confidence */}
        <View style={styles.fieldHeader}>
          <Text weight="SemiBold" style={styles.fieldLabel}>{field.label}</Text>
          <Text weight="Bold" style={[styles.fieldConfText, { color: confColor }]}>
            {Math.round(field.confidence)}%
          </Text>
        </View>

        {/* Confidence bar */}
        <View style={styles.confidenceBarTrack}>
          <View
            style={[
              styles.confidenceBarFill,
              {
                width: `${Math.min(100, Math.max(0, field.confidence))}%`,
                backgroundColor: confColor,
              },
            ]}
          />
        </View>

        {/* Editable input */}
        <TextInput
          style={[
            styles.fieldInput,
            isLow && styles.fieldInputLow,
            field.editedValue !== field.value && styles.fieldInputEdited,
          ]}
          value={field.editedValue}
          onChangeText={(text) => onUpdate(index, text)}
          placeholder={field.label}
          placeholderTextColor={colors.mutedForeground}
          multiline={true}
          textAlignVertical="top"
        />

        {/* Show original if edited */}
        {field.editedValue !== field.value ? (
          <View style={styles.originalRow}>
            <Ionicons name="pencil" size={10} color={colors.mutedForeground} />
            <Text style={styles.originalText}>
              Original: {field.value}
            </Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sub-Component: Skeleton Loader
// ─────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <View style={styles.listContent}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <SkeletonCard key={i} delay={i * 150} />
      ))}
    </View>
  );
}

function SkeletonCard({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          delay,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonThumb} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        <View style={styles.skeletonBadge} />
      </View>
      <View style={styles.skeletonButton} />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sub-Component: Empty State
// ─────────────────────────────────────────────────────────────

function EmptyState({ subtitle }: { subtitle?: string }) {
  const [nuking, setNuking] = useState(false);
  const handleNuke = async () => {
    Alert.alert(
      "Clear Local Database",
      "This will permanently delete all local sessions, records, and sync queue data. It cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Wipe Data", 
          style: "destructive", 
          onPress: async () => {
            setNuking(true);
            const { nukeAndRebuildDatabase } = require('@/services/nukeDatabase');
            await nukeAndRebuildDatabase();
            Alert.alert("Success", "Local database cleared. Please pull to refresh to see changes or restart the app.");
            setNuking(false);
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="checkmark-done-circle"
          size={64}
          color={colors.primary}
        />
      </View>
      <View style={styles.emptyTextWrap}>
        <Text weight="Bold" style={styles.emptyTitle}>Queue Clear</Text>
        <Text weight="Medium" style={styles.emptySubtitle}>
          {subtitle || 'All records have been reviewed and approved. Pull down to refresh.'}
        </Text>
      </View>
      <Button 
         variant="outline" 
         style={{ marginTop: 24, alignSelf: 'center', borderColor: colors.destructive }}
         onPress={handleNuke}
         loading={nuking}
         disabled={nuking}
      >
        <Text weight="Bold" style={{ color: colors.destructive }}>Wipe Local Database</Text>
      </Button>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ──
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginTop: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  segmentActive: {
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  segmentText: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  segmentTextActive: {
    color: colors.foreground,
  },

  // ── List view ──
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },

  // ── Row card ──
  rowCard: {
    marginBottom: spacing.md,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.muted,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowPatientName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
  },
  rowPatientCode: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  rowBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },

  // ── Detail view ──
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.foreground,
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  detailPatientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  detailPatientName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  detailPatientCode: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  detailDate: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },

  // ── Image ──
  imageCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  detailImage: {
    width: '100%',
    height: SCREEN_WIDTH * 0.75,
    borderRadius: borderRadius.md,
    backgroundColor: colors.muted,
  },

  // ── Flagged reason ──
  flaggedCard: {
    marginBottom: spacing.lg,
  },
  flaggedContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  flaggedTextWrap: {
    flex: 1,
  },
  flaggedLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.warningForeground,
    marginBottom: 2,
  },
  flaggedText: {
    fontSize: fontSize.md,
    color: colors.foreground,
    lineHeight: 20,
  },

  // ── Fields section ──
  fieldsSection: {
    marginBottom: spacing.lg,
  },
  fieldsSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  fieldsSectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  noFieldsCard: {
    marginTop: spacing.sm,
  },
  noFieldsText: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // ── Field editor card ──
  fieldCard: {
    marginBottom: spacing.md,
  },
  fieldCardLow: {
    borderColor: 'rgba(239,68,68,0.3)',
  },
  fieldCardContent: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldConfText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  confidenceBarTrack: {
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  fieldInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  fieldInputLow: {
    borderColor: 'rgba(245,158,11,0.5)',
    backgroundColor: 'rgba(245,158,11,0.03)',
  },
  fieldInputEdited: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(13,148,136,0.04)',
  },
  originalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  originalText: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },

  // ── Footer ──
  detailFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.lg,
  },
  submitButton: {
    width: '100%',
  },

  // ── Skeleton ──
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonThumb: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.muted,
  },
  skeletonInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.muted,
    width: '80%',
  },
  skeletonLineShort: {
    width: '50%',
  },
  skeletonBadge: {
    height: 20,
    width: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.muted,
  },
  skeletonButton: {
    width: 64,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.muted,
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingTop: 160, // Fixed position from top instead of centered
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyTextWrap: {
    minHeight: 80, // Fixed height so the text block doesn't change layout size
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
  },
});
