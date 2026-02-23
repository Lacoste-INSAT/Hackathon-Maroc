import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { colors, fontSize as fontSizeTokens } from '@/lib/theme';

export type FontWeight = 'Regular' | 'Medium' | 'SemiBold' | 'Bold' | 'ExtraBold';

export interface TextProps extends RNTextProps {
  weight?: FontWeight;
  color?: string;
  size?: number;
}

const fontMap: Record<FontWeight, string> = {
  Regular: 'PlusJakartaSans_400Regular',
  Medium: 'PlusJakartaSans_500Medium',
  SemiBold: 'PlusJakartaSans_600SemiBold',
  Bold: 'PlusJakartaSans_700Bold',
  ExtraBold: 'PlusJakartaSans_800ExtraBold',
};

export function Text({ style, weight = 'Regular', color, size, ...props }: TextProps) {
  return (
    <RNText
      style={[
        {
          fontFamily: fontMap[weight],
          color: color || colors.foreground,
          fontSize: size || fontSizeTokens.md,
        },
        style,
      ]}
      {...props}
    />
  );
}
