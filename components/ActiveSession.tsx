import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentCamera } from '@/components/DocumentCamera';
import { useNetworkState } from '@/hooks/useNetworkState';
import { getSessionById, endSession } from '@/services/sessionRepository';
import { enqueuePhoto } from '@/services/offlineQueue';
import { updateRecordExtraction } from '@/services/recordRepository';
import { extractHandwritingFromBase64 } from '@/services/geminiService';
import { colors, spacing, borderRadius, fontSize, shadow } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Session } from '@/lib/types';
import { useSyncStore } from '@/stores/useSyncStore';
import { getDatabase } from '@/services/database';

type SessionState = 'overview' | 'camera' | 'analyzing' | 'review';

interface ActiveSessionProps {
  sessionId: string;
}

export function ActiveSession({ sessionId }: ActiveSessionProps) {
  const { isOnline } = useNetworkState();
  const setActiveSessionId = useSyncStore((s) => s.setActiveSessionId);
  const router = useRouter();
  
  const [session, setSession] = useState<Session | null>(null);
  const [viewState, setViewState] = useState<SessionState>('overview');
  
  // State for review
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);

  const [capturedNotesCount, setCapturedNotesCount] = useState<number>(0);

  useEffect(() => {
    async function fetchSession() {
      if (!sessionId) return;
      const s = await getSessionById(sessionId);
      if (s) setSession(s);
    }
    fetchSession();
  }, [sessionId]);

  // Load notes count
  useEffect(() => {
    async function fetchNotesCount() {
      if (!sessionId) return;
      try {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM records WHERE session_id = ?`,
          [sessionId]
        );
        setCapturedNotesCount(row?.count || 0);
      } catch (err) {
        console.error('[ActiveSession] Failed to fetch notes count:', err);
      }
    }
    if (viewState === 'overview') {
      fetchNotesCount();
    }
  }, [sessionId, viewState]);

  const handleCapture = async (uri: string) => {
    if (!session) return;
    setCapturedUri(uri);
    
    if (isOnline) {
      setViewState('analyzing');
      
      try {
        const result = await extractHandwritingFromBase64(uri);
        setExtractedData(result);
        setViewState('review');
      } catch (error) {
        console.error('[ActiveSession] AI Extraction failed:', error);
        Alert.alert('AI Error', 'Failed to extract text. The photo will be queued for later.', [
          { text: 'OK', onPress: async () => {
             // Fallback to offline queue
             await handleOfflineEnqueue(uri);
          }}
        ]);
      }
    } else {
      await handleOfflineEnqueue(uri);
    }
  };

  const handleOfflineEnqueue = async (uri: string) => {
    if (!session) return;
    try {
      await enqueuePhoto(session.id, uri);
      Alert.alert('Success', 'Document queued for offline sync.', [{ text: 'OK' }]);
      setViewState('overview');
    } catch (error) {
       console.error('[ActiveSession] Error saving capture:', error);
       Alert.alert('Error', 'Failed to save the captured document.');
       setViewState('overview');
    }
  };

  const handleApproveReview = async () => {
    if (!session || !capturedUri || !extractedData) return;
    try {
      // 1. Create the record and get ID
      const recordId = await enqueuePhoto(session.id, capturedUri);
      
      // 2. Immediately update the record with the extracted JSON so sync_worker 
      //    just uploads it as-is.
      await updateRecordExtraction(
        recordId,
        JSON.stringify(extractedData),
        extractedData.overallConfidence // Use extracted confidence
      );

      Alert.alert('Saved', 'Record approved and saved to system.');
      setViewState('overview');
      setCapturedUri(null);
      setExtractedData(null);
    } catch (err) {
      console.error('[ActiveSession] Approve review failed:', err);
      Alert.alert('Error', `Failed to save reviewed record: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    Alert.alert(
      'End Session',
      `Are you sure you want to end the session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Session', 
          style: 'destructive',
          onPress: async () => {
            await endSession(session.id);
            setActiveSessionId(null);
            // Since it's mounted in the home tab, clearing the ID will unmount it
          }
        }
      ]
    );
  };

  if (!session) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── 1. OVERVIEW STATE ───────────────────────────────────────
  if (viewState === 'overview') {
    return (
      <View style={styles.container}>
        <View style={styles.headerBanner}>
          <Text style={styles.headerTitle}>Snap & Sync v1.0</Text>
          <View style={styles.networkBadge}>
            <Ionicons name="wifi" size={14} color={isOnline ? colors.success : colors.warning} />
            <Text style={[styles.networkText, { color: isOnline ? colors.success : colors.warning }]}>
              {isOnline ? 'Status: Online' : 'Status: Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Card style={styles.sessionCard}>
            <CardContent>
              <View style={styles.sessionHeader}>
                <View style={styles.dot} />
                <Text style={styles.sessionTitle}>Active Session</Text>
              </View>
              
              <View style={styles.patientInfoRow}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={24} color={colors.primary} />
                </View>
                <Text style={styles.patientName}>Patient [{session.patient_code}]</Text>
                <View style={styles.badgeLabel}>
                  <Text style={styles.badgeText}>In Progress</Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {capturedNotesCount > 0 && (
            <Card style={styles.sessionCard}>
              <CardContent>
                <View style={styles.patientInfoRow}>
                  <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                    <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.patientName, { fontSize: 14 }]}>
                      {capturedNotesCount} note{capturedNotesCount === 1 ? '' : 's'} captured
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      Saved locally, pending sync
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          <Text style={styles.hintText}>
            {isOnline 
              ? "Online - AI will analyze your notes in real-time" 
              : "Offline - Notes will be queued for later analysis"}
          </Text>

          <TouchableOpacity 
            style={styles.bigCaptureButton} 
            onPress={() => setViewState('camera')}
            activeOpacity={0.8}
          >
            <View style={styles.bigCaptureInner}>
              <Ionicons name="camera-outline" size={32} color="#fff" />
              <Text style={styles.bigCaptureText}>CAPTURE</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.captureNotesHint}>Capture Notes</Text>
        </View>

        <View style={styles.footer}>
          <Button variant="outline" onPress={handleEndSession} style={styles.endButton}>
            End Session
          </Button>
        </View>
      </View>
    );
  }

  // ── 2. CAMERA STATE ─────────────────────────────────────────
  if (viewState === 'camera') {
    return (
      <View style={styles.container}>
        {/* Custom Header for Camera */}
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => setViewState('overview')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.cameraTitle}>Capture Ordonnance</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.cameraWrapper}>
          <DocumentCamera 
            isOnline={isOnline} 
            onCapture={handleCapture}
            onBack={() => setViewState('overview')}
          />
        </View>
      </View>
    );
  }

  // ── 3. ANALYZING STATE ──────────────────────────────────────
  if (viewState === 'analyzing') {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <Ionicons name="sparkles" size={64} color={colors.primary} style={{ marginBottom: spacing.xl }} />
        <Text style={styles.analyzingTitle}>Analyzing with AI...</Text>
        <Text style={styles.analyzingSubtitle}>Gemini 2.5 Flash is reading the handwriting</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }

  // ── 4. REVIEW STATE ─────────────────────────────────────────
  if (viewState === 'review') {
    return (
      <View style={styles.container}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => setViewState('overview')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.cameraTitle}>Review Photo</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.reviewContent}>
          <Text style={styles.reviewPatientTitle}>Patient [{session.patient_code}]</Text>
          <Text style={styles.reviewPatientSubtitle}>
            <Ionicons name="sparkles" size={14} color={colors.primary} /> AI Extraction Complete
          </Text>

          {capturedUri && (
            <Image source={{ uri: capturedUri }} style={styles.reviewImage} resizeMode="cover" />
          )}

          <View style={styles.metricsRow}>
            <View style={styles.metricBadge}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.metricText}>Confidence: {extractedData?.overallConfidence}%</Text>
            </View>
            <View style={styles.metricBadge}>
              <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
              <Text style={styles.metricText}>Accuracy: {extractedData?.predictionScore}%</Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>GEMINI PREDICTIONS - TAP TO EDIT</Text>
          
          {extractedData?.fields?.map((field: any, idx: number) => (
            <View key={field.label || idx} style={styles.fieldBox}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldScore}>{field.confidence}%</Text>
              </View>
              <View style={styles.inputMock}>
                <Text style={styles.inputText}>{field.value}</Text>
              </View>
            </View>
          ))}

          <Button 
            variant="primary" 
            size="lg" 
            onPress={handleApproveReview} 
            style={styles.approveButton}
            icon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
          >
            Approve & Save
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            onPress={() => setViewState('camera')} 
            style={styles.retakeButton}
            icon={<Ionicons name="refresh-outline" size={20} color={colors.foreground} />}
          >
            Retake
          </Button>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerAll: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  headerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 12, color: colors.mutedForeground, fontWeight: '600' },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  networkText: { fontSize: 12, fontWeight: '600' },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center' },
  sessionCard: { width: '100%', marginBottom: spacing.xl, paddingVertical: spacing.md, ...shadow.sm },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  sessionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  patientInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  patientName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.foreground },
  badgeLabel: { backgroundColor: colors.successLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: colors.success, fontSize: 12, fontWeight: '600' },
  hintText: { textAlign: 'center', color: colors.mutedForeground, marginVertical: spacing.xl, fontSize: 14 },
  bigCaptureButton: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', ...shadow.lg,
    borderWidth: 6, borderColor: colors.primaryLight
  },
  bigCaptureInner: { alignItems: 'center' },
  bigCaptureText: { color: '#fff', fontWeight: 'bold', marginTop: 8, fontSize: 16 },
  captureNotesHint: { marginTop: spacing.md, fontSize: 16, fontWeight: '500', color: colors.foreground },
  footer: { padding: spacing.lg, paddingBottom: spacing.xxl },
  endButton: { borderRadius: borderRadius.full },
  
  // Camera State Styles
  cameraHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.xl, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.background
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '500' },
  cameraTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  cameraWrapper: { flex: 1, borderRadius: 24, overflow: 'hidden', margin: spacing.xs, marginBottom: spacing.xl },
  
  // Analyzing State
  analyzingTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm },
  analyzingSubtitle: { fontSize: 14, color: colors.mutedForeground },

  // Review State
  reviewContent: { flex: 1, padding: spacing.md },
  reviewPatientTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  reviewPatientSubtitle: { fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.md },
  reviewImage: { width: '100%', height: 250, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  metricsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  metricBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.successLight, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  metricText: { color: colors.success, fontWeight: '600', fontSize: 14 },
  sectionHeading: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginBottom: spacing.sm, letterSpacing: 0.5 },
  fieldBox: { marginBottom: spacing.md },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  fieldLabel: { fontSize: 14, color: colors.foreground, fontWeight: '500' },
  fieldScore: { fontSize: 12, color: colors.success, fontWeight: '700' },
  inputMock: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, backgroundColor: colors.card },
  inputText: { fontSize: 15, color: colors.foreground },
  approveButton: { marginTop: spacing.xl, marginBottom: spacing.md, borderRadius: borderRadius.md },
  retakeButton: { borderRadius: borderRadius.md },
});
