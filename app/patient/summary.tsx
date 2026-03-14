import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { getPatientProblemTree, getClinicalNarrative, getClinicalInsights, ingestOrdonnanceIntoGraph } from '@/services/patientDataService';
import { updateRecordStatus, updateRecordExtraction, getRecordById } from '@/services/recordRepository';
import { supabase } from '@/lib/supabase';
import { updateQueueItemStatus } from '@/services/offlineQueue';
import { getDatabase } from '@/services/database';
import { ProblemNode, PendingVerificationItem, ExtractionResult } from '@/lib/types';
import { AIVerificationInbox } from '@/components/patient/AIVerificationInbox';
import { AccordionItem } from '@/components/patient/ClinicalSummaryAccordion';
import { ClinicalInsights } from '@/components/patient/ClinicalInsights';
import { useNetInfo } from '@react-native-community/netinfo';
import { Button } from '@/components/ui/button';
import { FlashList } from '@shopify/flash-list';
import { debouncedSync } from '@/services/backgroundSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ClinicalSummaryScreen() {
  const { patientCode } = useLocalSearchParams<{ patientCode: string }>();
  const router = useRouter();
  const netInfo = useNetInfo();
  
  const [loading, setLoading] = useState(true);
  const [problemTree, setProblemTree] = useState<ProblemNode[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerificationItem[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingNarrative, setRefreshingNarrative] = useState(false);
  const _insightsRunRef = useRef(false);

  const loadData = async () => {
    if (!patientCode) return;
    try {
      const isOnline = netInfo.isConnected ?? false;
      const data = await getPatientProblemTree(patientCode, isOnline);
      setProblemTree(data.problemTree);
      setPendingVerifications(data.pendingVerifications);

      if (isOnline) {
        const { data: colCheck, error: colErr } = await supabase
          .from('records')
          .select('id, embedding, diagnoses, drugs, symptoms')
          .limit(1);
        
        console.log('[MIGRATION CHECK] data:', JSON.stringify(colCheck));
        console.log('[MIGRATION CHECK] error:', JSON.stringify(colErr));

        let cachedNarrative = null;
        let currentPatientId = null;

        try {
          const { data: patient } = await supabase.from('patients').select('id, clinical_summary').eq('patient_code', patientCode).single();
          if (patient) {
            cachedNarrative = patient.clinical_summary;
            currentPatientId = patient.id;
          }
        } catch (e) {
          console.error('[ClinicalSummary] Failed to run graph ingestion check:', e);
        }

        // CORRECT cache behavior: 
        if (cachedNarrative) {
          setNarrative(cachedNarrative);
        } else {
          const narrativeText = await getClinicalNarrative(patientCode, data.problemTree);
          setNarrative(narrativeText);
        }
        
        if (currentPatientId) {
          console.log('[SUMMARY] Starting ingestion check...');
          
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id')
            .eq('patient_id', currentPatientId);
          
          if (sessions && sessions.length > 0) {
            const sessionIds = sessions.map(s => s.id);
            
            const { data: unembeddedRecords, error: embedErr } = await supabase
              .from('records')
              .select('id, status')
              .in('session_id', sessionIds)
              .is('embedding', null);
            
            console.log('[SUMMARY] Unembedded (no embedding yet):', 
              unembeddedRecords?.length, 
              'error:', JSON.stringify(embedErr));
            
            if (unembeddedRecords && unembeddedRecords.length > 0) {
              const localPayload = JSON.stringify(
                data.problemTree?.map((visit: any) => ({
                  diagnoses: visit.diagnoses?.map((d: any) => d.value) ?? [],
                  medications: visit.medications?.map((m: any) => m.value) ?? [],
                  symptoms: visit.symptoms?.map((s: any) => s.value) ?? []
                })) ?? []
              );

              console.log('[SUMMARY] Starting ingestion...');
              
              // Call ingest only for the FIRST record — it does NER + embed
              const firstRecord = unembeddedRecords[0];
              await ingestOrdonnanceIntoGraph(firstRecord.id, localPayload);
              
              // If there are more records from the same visit/patient,
              // copy the embedding from the first record instead of re-calling Gemini
              if (unembeddedRecords.length > 1) {
                const { data: firstEmbedded } = await supabase
                  .from('records')
                  .select('embedding, diagnoses, drugs, symptoms')
                  .eq('id', firstRecord.id)
                  .single();
                
                if (firstEmbedded?.embedding) {
                  const remainingIds = unembeddedRecords.slice(1).map(r => r.id);
                  
                  for (const recordId of remainingIds) {
                    console.log('[SUMMARY] Copying embedding to related record:', recordId);
                    await supabase
                      .from('records')
                      .update({
                        embedding: firstEmbedded.embedding,
                        diagnoses: firstEmbedded.diagnoses,
                        drugs: firstEmbedded.drugs,
                        symptoms: firstEmbedded.symptoms
                      })
                      .eq('id', recordId);
                  }
                }
              }
              console.log('[SUMMARY] Ingestion complete.');
            }
          }
        }
        
        console.log('[SUMMARY] Now fetching insights...');
        if (!_insightsRunRef.current) {
          _insightsRunRef.current = true;
          const insightData = await getClinicalInsights(patientCode, data.problemTree);
          setInsights(insightData);
        } else {
          console.log('[SUMMARY] Insights already fetched, skipping duplicate call');
        }
      }
    } catch (error) {
      console.error('[ClinicalSummary] Failed to load data:', error);
      Alert.alert('Error', 'Failed to load clinical summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientCode]);

  const handleRefresh = async (forceNarrativeRefresh = false) => {
    if (forceNarrativeRefresh && netInfo.isConnected) {
      const REFRESH_COOLDOWN_MS = 60_000;
      const lastRefresh = await AsyncStorage.getItem(`narrative_refresh_${patientCode}`);
      const now = Date.now();
      
      if (lastRefresh && now - parseInt(lastRefresh, 10) < REFRESH_COOLDOWN_MS) {
        Alert.alert('Please wait', 'Please wait 60 seconds before regenerating the summary.');
        return;
      }
      
      setRefreshingNarrative(true);
      try {
        await AsyncStorage.setItem(`narrative_refresh_${patientCode}`, String(now));
        const narrativeText = await getClinicalNarrative(patientCode as string, problemTree, true);
        setNarrative(narrativeText);
        
        const insightData = await getClinicalInsights(patientCode as string, problemTree);
        setInsights(insightData);
      } catch (error) {
        console.error('Failed to force refresh narrative:', error);
      } finally {
        setRefreshingNarrative(false);
      }
    } else {
      setRefreshing(true);
      _insightsRunRef.current = false; // allow refresh to re-run
      await loadData();
      setRefreshing(false);
    }
  };

  const queueRecordUpdate = async (recordId: string) => {
      // Create a sync queue item for 'update_record' so it syncs later if offline
      const db = getDatabase();
      await db.runAsync(
         `INSERT INTO sync_queue (record_id, action, retry_count, status)
          VALUES (?, 'update_record', 0, 'pending')`,
         [recordId]
      );
      debouncedSync();
  };

  const handleApprove = async (item: PendingVerificationItem) => {
    setPendingVerifications(prev => prev.filter(p => p.id !== item.id));
    try {
      await updateRecordStatus(item.recordId, 'approved');
      await queueRecordUpdate(item.recordId);
      loadData(); 
    } catch (e) {
      console.error('Failed to approve:', e);
      loadData(); 
    }
  };

  const handleReject = async (item: PendingVerificationItem) => {
    setPendingVerifications(prev => prev.filter(p => p.id !== item.id));
    try {
       loadData();
    } catch (e) {
      console.error('Failed to reject:', e);
    }
  };

  const handleEdit = async (item: PendingVerificationItem, newValue: string) => {
    setPendingVerifications(prev => prev.filter(p => p.id !== item.id));
    try {
      const record = await getRecordById(item.recordId);
      if (record && record.extracted_data) {
        const extracted: ExtractionResult = typeof record.extracted_data === 'string' 
          ? JSON.parse(record.extracted_data) 
          : record.extracted_data;
          
        const fieldIndex = extracted.fields.findIndex(f => f.label === item.fieldLabel && f.value === item.fieldValue);
        if (fieldIndex >= 0) {
           extracted.fields[fieldIndex].value = newValue;
           extracted.fields[fieldIndex].confidence = 100; // Doctor corrected it
           await updateRecordExtraction(item.recordId, JSON.stringify(extracted), extracted.overallConfidence, null);
           await updateRecordStatus(item.recordId, 'approved');
           await queueRecordUpdate(item.recordId);
        }
      }
      loadData();
    } catch (e) {
       console.error('Failed to edit:', e);
       loadData();
    }
  };

  const handleRecordTap = (recordId: string) => {
    router.push(`/record/${recordId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button variant="ghost" onPress={() => router.back()} style={styles.closeBtn}>
           <Ionicons name="close" size={24} color={colors.foreground} />
        </Button>
        <Text style={styles.headerTitle}>Clinical Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
          data={problemTree}
          keyExtractor={(item) => item.diagnosis}
          // @ts-expect-error: FlashList's TS definitions from expo install are missing 'estimatedItemSize' despite it being a valid prop.
          estimatedItemSize={150}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <View>
              {narrative ? (
                <View style={styles.narrativeContainer}>
                  <View style={styles.narrativeHeader}>
                    <Text style={styles.narrativeTitle}>Clinical Handover Note</Text>
                    <Button variant="ghost" size="sm" onPress={() => handleRefresh(true)} disabled={refreshingNarrative}>
                      {refreshingNarrative ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="refresh" size={16} color={colors.primary} />
                      )}
                    </Button>
                  </View>
                  <Text style={styles.narrativeText}>{narrative.replace(/\*\*/g, '')}</Text>
                </View>
              ) : null}

              {insights && insights.length > 0 ? (
                <ClinicalInsights insight={insights} />
              ) : null}
              <AIVerificationInbox 
                items={pendingVerifications} 
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={handleEdit}
              />
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={48} color={colors.border} />
                <Text style={styles.emptyText}>No clinical data found.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <AccordionItem 
              problem={item} 
              onRecordTap={handleRecordTap}
            />
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    padding: spacing.xs,
    minHeight: 40,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  narrativeContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  narrativeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  narrativeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  narrativeText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl,
    flex: 1,
  },
  emptyText: {
    marginTop: spacing.sm,
    color: colors.mutedForeground,
    fontSize: 16,
  },
});
