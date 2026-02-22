import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { createSession } from '@/services/sessionRepository';
import { getCurrentUser } from '@/services/auth';
import { Card, CardContent } from '@/components/ui/Card';
import { useSyncStore } from '@/stores/useSyncStore';
import { colors, spacing, borderRadius, fontSize, shadow } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NewSessionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const simulateQRScan = async () => {
    setLoading(true);
    try {
      // 1. Mock the QR code extraction (Patient Ahmed Loukil)
      const mockPatientCode = 'AHM-924';
      
      // 2. Identify the doctor
      const user = await getCurrentUser();
      const doctorId = user?.id || 'doc-123';

      // 3. Create the SQLite session
      // In a real flow, you'd lookup the patient first to get their name,
      // but sessionRepository's createSession handles storing this locally.
      const sessionId = await createSession(mockPatientCode, 'Ahmed Loukil', doctorId);

      // 4. Navigate back to dashboard and set the active session
      useSyncStore.getState().setActiveSessionId(sessionId);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[NewSession] Failed to start:', error);
      Alert.alert('Error', 'Could not initialize session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <CardContent style={styles.cardContent}>
          <Ionicons name="qr-code-outline" size={64} color={colors.primary} style={{ marginBottom: spacing.md }} />
          <Text style={styles.title}>Scan Patient QR</Text>
          <Text style={styles.description}>
            Ask the patient for their QR code card to instantly pull up their file and begin a new session.
          </Text>

          <View style={styles.mockBox}>
            <Text style={styles.mockTitle}>Demo Mode</Text>
            <Text style={styles.mockText}>Click below to simulate scanning "Ahmed Loukil".</Text>
          </View>
        </CardContent>
      </Card>

      <Button
        onPress={simulateQRScan}
        variant="primary"
        size="lg"
        style={styles.button}
        disabled={loading}
      >
        {loading ? 'Starting...' : 'Simulate QR Scan'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  cardContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  mockBox: {
    backgroundColor: colors.muted,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  mockTitle: {
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  mockText: {
    color: colors.mutedForeground,
    textAlign: 'center',
    fontSize: fontSize.sm,
  },
  button: {
    marginTop: spacing.xl,
  },
});
