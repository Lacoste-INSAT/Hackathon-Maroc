// ─────────────────────────────────────────────────────────────
// Snap & Sync — Design System Theme (React Native)
// ─────────────────────────────────────────────────────────────

export const colors = {
  // ── Core palette ──
  primary: '#4F46E5',           // Muted Purple
  primaryForeground: '#ffffff',
  primaryLight: 'rgba(79, 70, 229, 0.12)',

  // ── Semantic ──
  success: '#10B981',           // Emerald 500 (Cohesive Accent)
  successForeground: '#ffffff',
  successLight: 'rgba(16, 185, 129, 0.12)',

  warning: '#F59E0B',           // Amber 500
  warningForeground: '#92400E',
  warningLight: 'rgba(245, 158, 11, 0.12)',

  destructive: '#FF3B30',       // Vibrant Red
  destructiveForeground: '#ffffff',
  destructiveLight: 'rgba(255, 59, 48, 0.12)',

  // ── Surfaces ──
  background: '#F8FAFC',        // Slate 50
  card: '#ffffff',
  cardBorder: '#E2E8F0',        // Slate 200

  // ── Text ──
  foreground: '#0F172A',        // Slate 900
  mutedForeground: '#64748B',   // Slate 500

  // ── Misc ──
  border: '#E2E8F0',            // Slate 200
  muted: '#F1F5F9',             // Slate 100
  overlay: 'rgba(15, 23, 42, 0.5)',
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
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
