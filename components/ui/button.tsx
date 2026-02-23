import React from 'react';
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, spacing, shadow } from '@/lib/theme';
import { Text } from '@/components/ui/Text';

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
  const isPrimary = variant === 'primary';
  const variantBg = bgVariants[variant];
  const variantText = textVariants[variant];
  const sizeStyle = sizeStyles[size];
  const sizeTextStyle = sizeTextStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        sizeStyle,
        isPrimary ? null : variantBg,
        disabled && styles.disabled,
        isPrimary && shadow.md,
        pressed && !disabled && !loading && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {isPrimary && (
        <LinearGradient
          colors={[colors.primary, '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.md }]}
        />
      )}
      <View style={styles.content}>
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
                weight="SemiBold"
                style={[{ color: variantText.color }, sizeTextStyle, textStyle]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    overflow: 'hidden', // to keep gradient inside
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    height: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { height: 36, paddingHorizontal: spacing.md },
  md: { height: 48, paddingHorizontal: spacing.lg },
  lg: { height: 56, paddingHorizontal: spacing.xl },
  xl: { height: 64, paddingHorizontal: spacing.xxl },
};

const sizeTextStyles: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 16 },
  lg: { fontSize: 18 },
  xl: { fontSize: 20 },
};

const bgVariants: Record<ButtonVariant, ViewStyle> = {
  primary: {}, // Handled by gradient
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  success: {
    backgroundColor: colors.success,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
};

const textVariants: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.primaryForeground },
  outline: { color: colors.foreground },
  ghost: { color: colors.primary },
  success: { color: colors.successForeground },
  destructive: { color: colors.destructiveForeground },
};
