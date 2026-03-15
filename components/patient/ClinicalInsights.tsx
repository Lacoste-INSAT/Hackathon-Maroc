import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { ActivityIndicator } from 'react-native';
import KnowledgeGraphLoader from '@/components/ui/KnowledgeGraphLoader';

export interface ClinicalInsightsProps {
  insight: any;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isLoading?: boolean;
}

export function ClinicalInsights({ insight, onRefresh, isRefreshing, isLoading }: ClinicalInsightsProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="git-network-outline" size={20} color={colors.primary} />
            <Text style={[styles.title, { color: colors.primary }]}>Second Brain Insights</Text>
          </View>
        </View>
        <View style={styles.loaderWrapper}>
          <KnowledgeGraphLoader size="md" message="Extracting medical relations..." />
        </View>
      </View>
    );
  }

  if (!insight) return null;
  
  const text = typeof insight === 'string' ? insight : insight.insightText;
  const matches = typeof insight === 'string' ? [] : (insight.matches || []);

  if (!text) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="git-network-outline" size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.primary }]}>Second Brain Insights</Text>
        </View>
        {onRefresh && (
          <Button variant="ghost" size="sm" onPress={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={colors.primary} />
            )}
          </Button>
        )}
      </View>
      
      <View style={styles.insightContent}>
        <Text style={styles.insightText}>{text}</Text>
        
        {matches && matches.length > 0 && (
          <View style={styles.matchesContainer}>
            <Text style={styles.matchesTitle}>Mathematical Matches (pgvector)</Text>
            {matches.map((m: any, idx: number) => (
              <View key={m.id || idx} style={styles.matchItem}>
                <Text style={styles.matchScore}>Match {idx + 1}: {(m.similarity * 100).toFixed(1)}% Similarity</Text>
                <Text style={styles.matchData}>{m.dataSummary}</Text>
              </View>
            ))}
          </View>
        )}
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
  loaderWrapper: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  matchesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: `${colors.primary}20`,
  },
  matchesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchItem: {
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  matchScore: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  matchData: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  }
});
