import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { colors, spacing, borderRadius, fontSize, fontWeight, getConfidenceColor, getConfidenceBg, shadow } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/Text';
import { getRecordById, updateRecordCorrections, updateRecordStatus } from '@/services/recordRepository';
import { getSessionById } from '@/services/sessionRepository';
import { debouncedSync } from '@/services/backgroundSync';
import { formatName, formatCode } from '@/lib/stringUtils';
import type { Record as DBRecord, ExtractionResult, Session, ExtractionField } from '@/lib/types';

interface EditableField extends ExtractionField {
  editedValue: string;
}

function CircularProgress({ value, size = 64, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (value / 100) * circumference;
  const color = getConfidenceColor(value);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          stroke={colors.muted}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text weight="Bold" style={{ fontSize: size * 0.3, color }}>{Math.round(value)}</Text>
      </View>
    </View>
  );
}

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [record, setRecord] = useState<DBRecord | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editableFields, setEditableFields] = useState<EditableField[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const rec = await getRecordById(id);
        if (rec) {
          setRecord(rec);
          const sess = await getSessionById(rec.session_id);
          setSession(sess);
          
          let extracted: any[] = [];
          try {
            if (rec.extracted_data) {
              const parsed: ExtractionResult = JSON.parse(rec.extracted_data);
              extracted = parsed.fields || [];
            }
          } catch {}

          let corrections: any[] = [];
          try {
            if (rec.doctor_corrections) {
              corrections = JSON.parse(rec.doctor_corrections);
            }
          } catch {}

          // Initialize editable fields merging corrections if present
          const initFields = extracted.map(f => {
            const correction = corrections.find((c: any) => c.label === f.label);
            if (correction) {
              return { ...f, value: correction.originalValue, editedValue: correction.correctedValue };
            }
            return { ...f, editedValue: f.value };
          });
          setEditableFields(initFields);
        }
      } catch (err) {
        console.error('[RecordDetailScreen] Error loading record:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleUpdateField = useCallback((index: number, value: string) => {
    setEditableFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, editedValue: value } : f))
    );
  }, []);

  const handleSave = async () => {
    if (!record) return;
    setSubmitting(true);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // We explicitly always save corrections JSON so that the derived status knows a human reviewed it
      const corrections = editableFields.map((f) => ({
        label: f.label,
        originalValue: f.value,
        correctedValue: f.editedValue,
        confidence: f.confidence,
      }));
      await updateRecordCorrections(record.id, JSON.stringify(corrections));
      await updateRecordStatus(record.id, 'approved');
      debouncedSync();

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      console.error('Failed to save record:', err);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="document-text-outline" size={64} color={colors.mutedForeground} />
        <Text style={styles.errorText}>Record not found</Text>
        <Button variant="outline" onPress={() => router.back()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  const confidence = record.overall_confidence ?? 0;
  
  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          <Text weight="Medium" style={styles.backText}>Back</Text>
        </Button>
        {!!(session && session.patient_code && session.patient_code !== '—') && (
          <Button 
            variant="outline" 
            size="sm" 
            onPress={() => router.push(`/patient/summary?patientCode=${session.patient_code}`)}
            style={{ marginLeft: 'auto' } as any}
          >
            <Ionicons name="documents-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Clinical Summary</Text>
          </Button>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Patient Info */}
        <View style={styles.patientInfo}>
          <Text weight="Bold" style={styles.patientName}>
            {session?.patient_name && session.patient_name !== 'Unknown Patient' 
              ? formatName(session.patient_name) 
              : formatCode(session?.patient_code)}
          </Text>
          {!!(session?.patient_name && session.patient_name !== 'Unknown Patient') && (
            <Text style={styles.patientCode}>{formatCode(session?.patient_code)}</Text>
          )}
          <Text style={styles.dateText}>
            Captured: {new Date(record.created_at).toLocaleString()}
          </Text>
        </View>

        {/* Confidence Ring Section */}
        <View style={styles.confidenceSection}>
           <CircularProgress value={confidence} size={56} strokeWidth={5} />
           <View style={{ marginLeft: 16 }}>
             <Text style={styles.confSubtitle}>Confidence level</Text>
             <Text weight="Bold" style={[styles.confLevel, { color: getConfidenceColor(confidence) }]}>
               {confidence >= 90 ? 'High' : confidence >= 75 ? 'Medium' : 'Low'}
             </Text>
           </View>
        </View>

        {/* Image */}
        <Card style={styles.imageCard}>
          <Image
            source={{ uri: record.original_image_path }}
            style={styles.image}
            resizeMode="cover"
          />
        </Card>

        {/* Flagged Reason */}
        {record.flagged_reason ? (
          <Card variant="warning" style={styles.flaggedCard}>
            <CardContent style={styles.flaggedContent}>
               <Ionicons name="warning-outline" size={18} color={colors.warning} />
               <View style={styles.flaggedTextWrap}>
                 <Text weight="SemiBold" style={styles.flaggedTitle}>Flagged Reason</Text>
                 <Text style={styles.flaggedDesc}>{record.flagged_reason}</Text>
               </View>
            </CardContent>
          </Card>
        ) : null}

        {/* Data Fields */}
        <View style={styles.dataSection}>
          <Text weight="Bold" style={styles.sectionTitle}>Extracted Data</Text>
          
          {editableFields.length === 0 ? (
            <Card style={styles.noDataCard}>
              <CardContent>
                 <Text style={styles.noDataText}>No extracted data available.</Text>
              </CardContent>
            </Card>
          ) : (
            editableFields.map((field, idx) => {
              const isEdited = field.editedValue !== field.value;
              return (
                <Card key={`${field.label}-${idx}`} style={styles.fieldCard}>
                  <CardContent style={styles.fieldCardContent}>
                    <View style={styles.fieldHeader}>
                      <Text weight="SemiBold" style={styles.fieldLabel}>{field.label}</Text>
                      <Text weight="Bold" style={[styles.fieldConf, { color: getConfidenceColor(field.confidence) }]}>
                        {Math.round(field.confidence)}%
                      </Text>
                    </View>
                    
                    <TextInput
                      style={styles.fieldInput}
                      value={field.editedValue}
                      onChangeText={(text) => handleUpdateField(idx, text)}
                      placeholder={field.label}
                      placeholderTextColor={colors.mutedForeground}
                      multiline={true}
                    />
                    
                    {isEdited && (
                      <View style={styles.correctionRow}>
                        <Ionicons name="pencil" size={10} color={colors.mutedForeground} />
                        <Text style={styles.correctionText}>
                          Original: {field.value}
                        </Text>
                      </View>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          size="xl"
          onPress={handleSave}
          loading={submitting}
          disabled={submitting}
          style={styles.saveButton}
          icon={<Ionicons name="checkmark-circle" size={22} color={colors.primaryForeground} />}
        >
          Save & Validate
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: 16, fontSize: 18, color: colors.mutedForeground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { fontSize: fontSize.md, color: colors.foreground },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  
  patientInfo: { marginBottom: spacing.md },
  patientName: { fontSize: fontSize.xxl, color: colors.foreground, marginBottom: 2 },
  patientCode: { fontSize: fontSize.md, color: colors.primary },
  dateText: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 4 },
  
  confidenceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  confSubtitle: { fontSize: fontSize.sm, color: colors.mutedForeground },
  confLevel: { fontSize: fontSize.lg, marginTop: 2 },

  imageCard: { marginBottom: spacing.lg, overflow: 'hidden' },
  image: { width: '100%', height: 300, backgroundColor: '#000' },
  
  flaggedCard: { marginBottom: spacing.lg },
  flaggedContent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm },
  flaggedTextWrap: { flex: 1 },
  flaggedTitle: { fontSize: fontSize.sm, color: colors.warningForeground, marginBottom: 2 },
  flaggedDesc: { fontSize: fontSize.md, color: colors.foreground },
  
  dataSection: { marginTop: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, color: colors.foreground, marginBottom: spacing.md },
  noDataCard: { marginTop: spacing.sm },
  noDataText: { fontSize: fontSize.md, color: colors.mutedForeground, paddingVertical: spacing.lg, textAlign: 'center' },
  
  fieldCard: { marginBottom: spacing.md },
  fieldCardLow: { borderColor: 'rgba(239,68,68,0.3)' },
  fieldCardContent: { paddingVertical: spacing.md, gap: spacing.sm },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: fontSize.sm, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldConf: { fontSize: fontSize.sm },
  fieldInput: {
    fontSize: fontSize.md,
    color: colors.foreground,
    fontWeight: '500', // Matches the old fontWeight.medium
    padding: 0,
    margin: 0,
    minHeight: undefined,
  },
  correctionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  correctionText: { fontSize: fontSize.xs, color: colors.mutedForeground, fontStyle: 'italic' },

  footer: {
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
  saveButton: { width: '100%' },
});
