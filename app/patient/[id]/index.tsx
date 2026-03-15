import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="folder-open-outline" size={48} color={colors.primary} />
        </View>

        <Text style={styles.title}>Patient Profile</Text>
        <Text style={styles.subtitle}>ID: {id}</Text>

        <Text style={styles.description}>
          View all records associated with this patient or ask the AI Assistant
          questions about their medical history.
        </Text>

        <Button
          variant="primary"
          onPress={() => router.push(`/patient/${id}/assistant`)}
          icon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primaryForeground} style={{ marginRight: 6 }} />}
          style={styles.assistantButton}
        >
          AI Assistant
        </Button>

        <Button
          variant="outline"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  assistantButton: {
    minWidth: 200,
    marginBottom: spacing.md,
  },
  backButton: {
    minWidth: 160,
  },
});
