import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { DocumentCamera } from '@/components/DocumentCamera';
import { colors } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { useNetworkState } from '@/hooks/useNetworkState';
import { createSession, getActiveSession } from '@/services/sessionRepository';
import { enqueuePhoto } from '@/services/offlineQueue';

export default function CaptureScreen() {
  const router = useRouter();
  const { isOnline } = useNetworkState();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const handleCapture = async (uri: string) => {
    try {
      // 1. Get or create a session
      let session = await getActiveSession();
      if (!session) {
        // Create a mock session for testing if none exists
        await createSession('PAT-MOCK-123', 'Mock Patient', 'doc-123');
        session = await getActiveSession();
      }

      if (!session) {
        throw new Error("Could not initialize a session.");
      }

      // 2. Enqueue the photo for background sync
      // The worker (started in _layout.tsx) will detect this insertion
      // and automatically upload it to Supabase if online.
      await enqueuePhoto(session.id, uri);

      Alert.alert('Success', `Image saved locally and queued for sync!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
       console.error('[CaptureScreen] Error saving capture:', error);
       Alert.alert('Error', 'Failed to save the captured document.');
    }
  };

  return (
    <View style={styles.container}>
      <DocumentCamera
        isOnline={isOnline}
        onCapture={handleCapture}
        onBack={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
