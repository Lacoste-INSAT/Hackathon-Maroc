// ─────────────────────────────────────────────────────────────
// Snap & Sync — Design System Theme (React Native)
// ─────────────────────────────────────────────────────────────

export const colors = {
  // ── Core palette ──
  primary: '#0d9488',           // teal-600
  primaryForeground: '#ffffff',
  primaryLight: 'rgba(13,148,136,0.12)',

  // ── Semantic ──
  success: '#16a34a',           // green-600
  successForeground: '#ffffff',
  successLight: 'rgba(22,163,74,0.12)',

  warning: '#f59e0b',           // amber-500
  warningForeground: '#92400e',
  warningLight: 'rgba(245,158,11,0.12)',

  destructive: '#ef4444',       // red-500
  destructiveForeground: '#ffffff',
  destructiveLight: 'rgba(239,68,68,0.12)',

  // ── Surfaces ──
  background: '#f4f4f5',        // zinc-100
  card: '#ffffff',
  cardBorder: '#e4e4e7',        // zinc-200

  // ── Text ──
  foreground: '#18181b',        // zinc-900
  mutedForeground: '#71717a',   // zinc-500

  // ── Misc ──
  border: '#e4e4e7',
  muted: '#f4f4f5',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ── Confidence Helpers ──

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return colors.success;
  if (confidence >= 75) return colors.primary;
  return colors.destructive;
}

export function getConfidenceBg(confidence: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (confidence >= 90)
    return {
      bg: colors.successLight,
      text: colors.success,
      border: 'rgba(22,163,74,0.2)',
    };
  if (confidence >= 75)
    return {
      bg: colors.primaryLight,
      text: colors.primary,
      border: 'rgba(13,148,136,0.2)',
    };
  return {
    bg: colors.destructiveLight,
    text: colors.destructive,
    border: 'rgba(239,68,68,0.2)',
  };
}
