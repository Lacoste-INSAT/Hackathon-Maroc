// ─────────────────────────────────────────────────────────────
// Snap & Sync — Native QR Scanner (expo-camera)
// ─────────────────────────────────────────────────────────────
//
// Uses CameraView with built-in barcode scanning.
// Falls back to manual ID entry after 5 seconds.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  type TextInput as RNTextInput,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadow } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_FRAME_SIZE = SCREEN_WIDTH * 0.6;

interface QrScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

export function QrScanner({ visible, onClose, onScanSuccess }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanTimeout, setScanTimeout] = useState(false);
  const [scanned, setScanned] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<RNTextInput>(null);

  // ── Scan line animation ──
  useEffect(() => {
    if (!visible || showManualEntry) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [visible, showManualEntry, scanLineAnim]);

  // ── Timeout → show manual entry fallback ──
  useEffect(() => {
    if (!visible) {
      setScanTimeout(false);
      setShowManualEntry(false);
      setManualCode('');
      setScanned(false);
      return;
    }

    const timer = setTimeout(() => setScanTimeout(true), 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  // ── Request permission on open ──
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // ── Barcode scanned handler ──
  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);
      onScanSuccess(result.data);
    },
    [scanned, onScanSuccess]
  );

  // ── Manual submit ──
  function handleManualSubmit() {
    if (manualCode.length >= 3) {
      onScanSuccess(manualCode.toUpperCase());
    }
  }

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_FRAME_SIZE - 4],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!showManualEntry ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Scan Patient QR</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Camera View */}
            <View style={styles.cameraContainer}>
              {permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
              ) : (
                <View style={styles.permissionDenied}>
                  <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.permissionText}>Camera access required</Text>
                  <Button variant="primary" onPress={requestPermission}>
                    Grant Permission
                  </Button>
                </View>
              )}

              {/* Vignette overlay */}
              <View style={styles.vignette} pointerEvents="none" />

              {/* Scan frame */}
              <View style={styles.scanFrame} pointerEvents="none">
                {/* Corner brackets */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated scan line */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineTranslateY }] },
                  ]}
                />

                {/* Status text */}
                <View style={styles.statusContainer}>
                  {!scanTimeout ? (
                    <>
                      <Ionicons name="scan-outline" size={32} color={colors.primary} />
                      <Text style={styles.statusText}>Looking for QR code…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={32} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.statusText}>No QR code detected</Text>
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {scanTimeout && (
                <TouchableOpacity
                  onPress={() => {
                    setShowManualEntry(true);
                    setTimeout(() => inputRef.current?.focus(), 300);
                  }}
                  style={styles.manualLink}
                >
                  <Ionicons name="keypad-outline" size={18} color={colors.primary} />
                  <Text style={styles.manualLinkText}>QR Damaged? Enter ID Manually</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          /* ── Manual Entry Screen ── */
          <View style={styles.manualContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Enter Patient ID</Text>
              <TouchableOpacity
                onPress={() => setShowManualEntry(false)}
                style={styles.closeButton}
              >
                <Ionicons name="arrow-back" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.manualContent}>
              <Text style={styles.manualDescription}>
                Type the ID printed below the QR code on the booklet
              </Text>
              <Input
                ref={inputRef}
                value={manualCode}
                onChangeText={(text) => setManualCode(text.slice(0, 7))}
                placeholder="e.g., AHM-924"
                autoCapitalize="characters"
                style={styles.manualInput}
                autoFocus
              />
              <Text style={styles.manualHint}>Format: 3 letters - 3 digits (e.g., AHM-924)</Text>
            </View>

            <View style={styles.manualActions}>
              <Button
                variant="primary"
                size="xl"
                onPress={handleManualSubmit}
                disabled={manualCode.length < 3}
              >
                Confirm ID
              </Button>
              <TouchableOpacity onPress={() => setShowManualEntry(false)}>
                <Text style={styles.backToScannerText}>Back to QR scanner</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },

  // ── Camera ──
  cameraContainer: {
    flex: 1,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  permissionDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  permissionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: 'rgba(255,255,255,0.6)',
  },

  // ── Scan frame ──
  scanFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    marginTop: -SCAN_FRAME_SIZE / 2,
    marginLeft: -SCAN_FRAME_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: borderRadius.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: borderRadius.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: borderRadius.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: borderRadius.md,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.8,
  },
  statusContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  manualLinkText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },

  // ── Manual Entry ──
  manualContainer: {
    flex: 1,
  },
  manualContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  manualDescription: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  manualInput: {
    height: 64,
    fontSize: 28,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    letterSpacing: 4,
    width: '100%',
  },
  manualHint: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  manualActions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    gap: spacing.md,
    alignItems: 'center',
  },
  backToScannerText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
});
