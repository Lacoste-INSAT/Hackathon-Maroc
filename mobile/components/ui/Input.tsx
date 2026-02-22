// ─────────────────────────────────────────────────────────────
// Snap & Sync — Native Input Component
// ─────────────────────────────────────────────────────────────

import React, { forwardRef } from 'react';
import { TextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, fontSize, fontWeight } from '@/lib/theme';

export interface InputProps extends TextInputProps {
  variant?: 'default' | 'warning';
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ variant = 'default', containerStyle, style, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          variant === 'warning' && styles.warning,
          containerStyle,
          style,
        ]}
        {...props}
      />
    );
  }
);

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  warning: {
    borderColor: 'rgba(245,158,11,0.5)',
    backgroundColor: 'rgba(245,158,11,0.03)',
  },
});
