// ─────────────────────────────────────────────────────────────
// Snap & Sync — Native Button Component
// ─────────────────────────────────────────────────────────────

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadow } from '@/lib/theme';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const variantBg = bgVariants[variant];
  const variantText = textVariants[variant];
  const sizeStyle = sizeStyles[size];
  const sizeTextStyle = sizeTextStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        sizeStyle,
        variantBg,
        disabled && styles.disabled,
        variant === 'primary' && shadow.md,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.primaryForeground}
        />
      ) : (
        <>
          {icon}
          {typeof children === 'string' ? (
            <Text
              style={[styles.buttonText, sizeTextStyle, variantText, textStyle]}
            >
              {children}
            </Text>
          ) : (
            children
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    fontWeight: fontWeight.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { height: 36, paddingHorizontal: spacing.md },
  md: { height: 44, paddingHorizontal: spacing.lg },
  lg: { height: 52, paddingHorizontal: spacing.xl },
  xl: { height: 60, paddingHorizontal: spacing.xxl, borderRadius: borderRadius.lg },
};

const sizeTextStyles: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: fontSize.sm },
  md: { fontSize: fontSize.md },
  lg: { fontSize: fontSize.lg },
  xl: { fontSize: fontSize.xl },
};

const bgVariants: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  success: { backgroundColor: colors.success },
  destructive: { backgroundColor: colors.destructive },
};

const textVariants: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.primaryForeground },
  outline: { color: colors.foreground },
  ghost: { color: colors.primary },
  success: { color: colors.successForeground },
  destructive: { color: colors.destructiveForeground },
};
