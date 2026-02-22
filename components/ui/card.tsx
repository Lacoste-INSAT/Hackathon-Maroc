// ─────────────────────────────────────────────────────────────
// Snap & Sync — Native Card Component
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { colors, borderRadius, spacing, shadow, fontSize, fontWeight } from '@/lib/theme';

// ── Card ──

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'success' | 'warning' | 'primary';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const variantStyle = variantStyles[variant];
  return (
    <View style={[styles.card, variantStyle, style]}>
      {children}
    </View>
  );
}

// ── CardHeader ──

interface CardHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[styles.cardHeader, style]}>{children}</View>;
}

// ── CardTitle ──

interface CardTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function CardTitle({ children, style }: CardTitleProps) {
  return <Text style={[styles.cardTitle, style]}>{children}</Text>;
}

// ── CardContent ──

interface CardContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.cardContent, style]}>{children}</View>;
}

// ── Styles ──

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
  },
  cardHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});

const variantStyles: Record<string, ViewStyle> = {
  default: {},
  success: {
    borderColor: 'rgba(22,163,74,0.3)',
    backgroundColor: 'rgba(22,163,74,0.03)',
  },
  warning: {
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.03)',
  },
  primary: {
    borderColor: 'rgba(13,148,136,0.2)',
    backgroundColor: 'rgba(13,148,136,0.03)',
  },
};
