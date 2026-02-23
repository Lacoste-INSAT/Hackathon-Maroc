import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { colors, borderRadius, spacing, shadow } from '@/lib/theme';
import { Text } from '@/components/ui/Text';

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
  return <Text weight="SemiBold" style={[styles.cardTitle, style]}>{children}</Text>;
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
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.md, // Colored Corporate Trust shadow
  },
  cardHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
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
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'transparent',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    borderColor: 'transparent',
  },
};
