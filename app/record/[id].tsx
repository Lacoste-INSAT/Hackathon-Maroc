import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight, getConfidenceColor, getConfidenceBg } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getRecordById } from '@/services/recordRepository';
import { getSessionById } from '@/services/sessionRepository';
import { formatName, formatCode } from '@/lib/stringUtils';
import type { Record as DBRecord, ExtractionResult, Session } from '@/lib/types';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [record, setRecord] = useState<DBRecord | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const rec = await getRecordById(id);
        if (rec) {
          setRecord(rec);
          const sess = await getSessionById(rec.session_id);
          setSession(sess);
        }
      } catch (err) {
        console.error('[RecordDetailScreen] Error loading record:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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
  
  let extractedFields: any[] = [];
  try {
    if (record.extracted_data) {
      const parsed: ExtractionResult = JSON.parse(record.extracted_data);
      extractedFields = parsed.fields || [];
    }
  } catch {}

  let corrections: any[] = [];
  try {
    if (record.doctor_corrections) {
      corrections = JSON.parse(record.doctor_corrections);
    }
  } catch {}

  // Merge original fields with corrections if any
  const displayFields = extractedFields.map(f => {
    const correction = corrections.find((c: any) => c.label === f.label);
    if (correction) {
      return { ...f, value: correction.correctedValue, originalValue: correction.originalValue, isCorrected: true };
    }
    return f;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          <Text style={styles.backText}> Back</Text>
        </Button>
        <Badge
          variant={
            confidence >= 90 ? 'success' : confidence >= 75 ? 'default' : 'destructive'
          }
        >
          {`Confidence: ${Math.round(confidence)}%`}
        </Badge>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{formatName(session?.patient_name)}</Text>
          <Text style={styles.patientCode}>{formatCode(session?.patient_code)}</Text>
          <Text style={styles.dateText}>
            Captured: {new Date(record.created_at).toLocaleString()}
          </Text>
        </View>

        <Card style={styles.imageCard}>
          <Image
            source={{ uri: record.original_image_path }}
            style={styles.image}
            resizeMode="cover"
          />
        </Card>

        {record.flagged_reason ? (
          <Card variant="warning" style={styles.flaggedCard}>
            <CardContent>
              <Text style={styles.flaggedTitle}>Flagged Reason</Text>
              <Text style={styles.flaggedDesc}>{record.flagged_reason}</Text>
            </CardContent>
          </Card>
        ) : null}

        <View style={styles.dataSection}>
          <Text style={styles.sectionTitle}>Extracted Data</Text>
          
          {displayFields.length === 0 ? (
            <Text style={styles.noDataText}>No extracted data available.</Text>
          ) : (
            displayFields.map((field, idx) => (
              <Card key={`${field.label}-${idx}`} style={styles.fieldCard}>
                <CardContent style={styles.fieldCardContent}>
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={[styles.fieldConf, { color: getConfidenceColor(field.confidence) }]}>
                      {Math.round(field.confidence)}%
                    </Text>
                  </View>
                  <Text style={styles.fieldValue}>{field.value}</Text>
                  
                  {field.isCorrected && (
                    <View style={styles.correctionRow}>
                      <Ionicons name="pencil" size={12} color={colors.mutedForeground} />
                      <Text style={styles.correctionText}>
                        Original AI prediction: {field.originalValue}
                      </Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: colors.mutedForeground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.foreground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  patientInfo: {
    marginBottom: spacing.lg,
  },
  patientName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  patientCode: {
    fontSize: fontSize.md,
    color: colors.primary,
    marginTop: 2,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  imageCard: {
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  flaggedCard: {
    marginBottom: spacing.xl,
  },
  flaggedTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.warningForeground,
    marginBottom: 4,
  },
  flaggedDesc: {
    fontSize: fontSize.sm,
    color: colors.warningForeground,
    opacity: 0.8,
  },
  dataSection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  noDataText: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  fieldCard: {
    marginBottom: spacing.sm,
  },
  fieldCardContent: {
    padding: spacing.md,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
  },
  fieldConf: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  fieldValue: {
    fontSize: fontSize.md,
    color: colors.foreground,
    fontWeight: fontWeight.medium,
  },
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  correctionText: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
});
