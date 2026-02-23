import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { getConfidenceColor, colors } from '@/lib/theme';

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

export function CircularProgress({ value, size = 64, strokeWidth = 6, showText = true }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Cap value between 0 and 100
  const safeValue = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
  const dashoffset = circumference - (safeValue / 100) * circumference;
  const color = getConfidenceColor(safeValue);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          stroke={colors.muted}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showText && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text weight="Bold" style={{ fontSize: size * 0.3, color }}>{Math.round(safeValue)}</Text>
        </View>
      )}
    </View>
  );
}
