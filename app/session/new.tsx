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
import { QrScanner } from '@/components/QrScanner';

export default function NewSessionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const handleScanSuccess = async (scannedCode: string) => {
    setScannerVisible(false);
    setLoading(true);
    try {
      const patientCode = scannedCode.trim();
      
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Cannot create session.');
      }
      const doctorId = user.id;

      // Create the SQLite session
      // In a real flow, you might look up the patient first to get their name.
      const sessionId = await createSession(patientCode, null, doctorId);

      // Navigate back to dashboard and set the active session
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
        </CardContent>
      </Card>

      <Button
        onPress={() => setScannerVisible(true)}
        variant="primary"
        size="lg"
        style={styles.button}
        disabled={loading}
      >
        {loading ? 'Starting...' : 'Open Scanner'}
      </Button>

      <QrScanner 
        visible={scannerVisible} 
        onClose={() => setScannerVisible(false)} 
        onScanSuccess={handleScanSuccess} 
      />
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
  button: {
    marginTop: spacing.xl,
  },
});
