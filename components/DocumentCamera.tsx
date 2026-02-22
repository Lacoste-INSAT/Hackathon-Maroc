// ─────────────────────────────────────────────────────────────
// Snap & Sync — Native Document Camera (expo-camera + expo-file-system)
// ─────────────────────────────────────────────────────────────
//
// Captures handwritten ordonnances using the device camera.
// CRITICAL: The original full-resolution photo is ALWAYS saved
// to the app's document directory immediately upon capture.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { getInfoAsync, makeDirectoryAsync, moveAsync, documentDirectory } from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadow } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DocumentCameraProps {
  isOnline: boolean;
  onCapture: (originalUri: string) => void;
  onBack: () => void;
}

export function DocumentCamera({ isOnline, onCapture, onBack }: DocumentCameraProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    try {
      // Take photo at high quality — this is the ORIGINAL full-res capture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false, // let the camera pipeline optimize
      });

      if (!photo?.uri) {
        throw new Error('Camera returned no photo URI');
      }

      // ── CRITICAL: Save original to document directory IMMEDIATELY ──
      const timestamp = Date.now();
      const filename = `original_${timestamp}.jpg`;
      const documentDir = typeof documentDirectory === 'string'
        ? documentDirectory
        : (FileSystem as any).documentDirectory;
      const permanentPath = `${documentDir}originals/`;

      // Ensure directory exists
      const dirInfo = await getInfoAsync(permanentPath);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(permanentPath, { intermediates: true });
      }

      // Move file from temp cache to permanent storage
      const permanentUri = `${permanentPath}${filename}`;
      await moveAsync({
        from: photo.uri,
        to: permanentUri,
      });

      console.log('[DocumentCamera] Original saved:', permanentUri);
      onCapture(permanentUri);
    } catch (error) {
      console.error('[DocumentCamera] Capture failed:', error);
    } finally {
      setCapturing(false);
    }
  }

  // ── Permission not yet granted ──
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={colors.mutedForeground} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionDescription}>
          We need camera access to capture patient ordonnances.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Capture Ordonnance</Text>
        <View style={{ width: 64 }} />
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          mute={true}
        />

        {/* Document frame overlay */}
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={styles.documentFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Instruction text */}
            <View style={styles.instructionContainer}>
              <Ionicons name="document-text-outline" size={36} color="rgba(255,255,255,0.5)" />
              <Text style={styles.instructionText}>
                Align the ordonnance{'\n'}within the frame
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Shutter */}
      <View style={styles.shutterContainer}>
        <TouchableOpacity
          style={styles.shutterButton}
          onPress={handleCapture}
          disabled={capturing}
          activeOpacity={0.8}
        >
          {capturing ? (
            <ActivityIndicator size="large" color={colors.primaryForeground} />
          ) : (
            <View style={styles.shutterInner}>
              <Ionicons name="camera" size={28} color={colors.primaryForeground} />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.shutterHint}>
          {isOnline
            ? 'Take photo — You will preview before AI analyzes'
            : 'Take photo — Will be saved locally for later sync'}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ──

const FRAME_WIDTH = SCREEN_WIDTH * 0.65;
const FRAME_HEIGHT = FRAME_WIDTH * 1.35; // A4-ish aspect ratio

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },

  // ── Camera ──
  cameraContainer: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentFrame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: borderRadius.sm,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: borderRadius.sm,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: borderRadius.sm,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: borderRadius.sm,
  },
  instructionContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  instructionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Shutter ──
  shutterContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
    ...shadow.lg,
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterHint: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
  },

  // ── Permission ──
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  permissionDescription: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    ...shadow.md,
  },
  permissionButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primaryForeground,
  },
});
