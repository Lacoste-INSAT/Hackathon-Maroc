import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { getPatientProblemTree } from '@/services/patientDataService';
import { updateRecordStatus, updateRecordExtraction, getRecordById } from '@/services/recordRepository';
import { updateQueueItemStatus } from '@/services/offlineQueue';
import { getDatabase } from '@/services/database';
import { ProblemNode, PendingVerificationItem, ExtractionResult } from '@/lib/types';
import { AIVerificationInbox } from '@/components/patient/AIVerificationInbox';
import { AccordionItem } from '@/components/patient/ClinicalSummaryAccordion';
import { useNetInfo } from '@react-native-community/netinfo';
import { Button } from '@/components/ui/button';
import { FlashList } from '@shopify/flash-list';
import { debouncedSync } from '@/services/backgroundSync';

export default function ClinicalSummaryScreen() {
  const { patientCode } = useLocalSearchParams<{ patientCode: string }>();
  const router = useRouter();
  const netInfo = useNetInfo();
  
  const [loading, setLoading] = useState(true);
  const [problemTree, setProblemTree] = useState<ProblemNode[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!patientCode) return;
    try {
      const isOnline = netInfo.isConnected ?? false;
      const data = await getPatientProblemTree(patientCode, isOnline);
      setProblemTree(data.problemTree);
      setPendingVerifications(data.pendingVerifications);
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
  }, [patientCode, netInfo.isConnected]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
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
            <AIVerificationInbox 
              items={pendingVerifications} 
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
            />
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
