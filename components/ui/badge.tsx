import React from 'react';
import { View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { colors, borderRadius, spacing } from '@/lib/theme';
import { Text } from '@/components/ui/Text';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  children,
  variant = 'default',
  style,
  textStyle,
}: BadgeProps) {
  const variantBg = bgStyles[variant];
  const variantText = textStyles[variant];
  return (
    <View style={[styles.badge, variantBg, style]}>
      {typeof children === 'string' ? (
        <Text weight="SemiBold" style={[styles.badgeText, variantText, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
  },
});

const bgStyles: Record<BadgeVariant, ViewStyle> = {
  default: {
    backgroundColor: colors.primaryLight,
  },
  success: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  warning: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  destructive: {
    backgroundColor: colors.destructiveLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  outline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
};

const textStyles: Record<BadgeVariant, TextStyle> = {
  default: { color: colors.primary },
  success: { color: colors.success },
  warning: { color: colors.warningForeground },
  destructive: { color: colors.destructive },
  outline: { color: colors.foreground },
};
