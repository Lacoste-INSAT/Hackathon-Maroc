import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

export interface ClinicalInsightsProps {
  insight: string;
}

export function ClinicalInsights({ insight }: ClinicalInsightsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="git-network-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.primary }]}>Second Brain Insights</Text>
      </View>
      
      <View style={styles.insightContent}>
        <Text style={styles.insightText}>{insight}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: `${colors.primary}10`, // Light tint of primary
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  insightContent: {
    paddingLeft: spacing.sm + 20, // Align text under icon
  },
  insightText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
    fontWeight: '500',
  },
});
