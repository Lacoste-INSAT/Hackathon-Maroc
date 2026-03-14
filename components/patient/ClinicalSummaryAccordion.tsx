import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ProblemNode, PatientDataPoint } from '@/lib/types';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  FadeIn, 
  FadeOut, 
  LinearTransition,
  useDerivedValue
} from 'react-native-reanimated';

export function AccordionItem({ problem, onRecordTap }: { problem: ProblemNode; onRecordTap: (id: string) => void; }) {
  const [expanded, setExpanded] = useState(false);

  const toggleAccordion = () => {
    setExpanded(prev => !prev);
  };

  const rotation = useDerivedValue(() => {
    return withTiming(expanded ? 90 : 0, { duration: 150 });
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }]
  }));

  const validDiagnoses = problem.diagnoses?.filter(diag => diag.value?.trim().length > 0) || [];
  const validMeds = problem.medications.filter(med => med.value?.trim().length > 0);
  const validSymp = problem.symptoms.filter(sym => sym.value?.trim().length > 0);

  const totalItems = validMeds.length + validSymp.length + validDiagnoses.length;

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.card}>
      <TouchableOpacity 
        style={styles.cardHeader} 
        onPress={toggleAccordion}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.diagnosisTitle}>
            {problem.diagnosis}
          </Text>
          <Text style={styles.countText}>
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View 
          entering={FadeIn.duration(200)} 
          exiting={FadeOut.duration(200)}
          style={styles.cardBody}
        >
          {validDiagnoses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Diagnosis</Text>
              {validDiagnoses.map(diag => (
                <DataPointRow key={diag.id} item={diag} icon="medical-outline" onRecordTap={onRecordTap} />
              ))}
            </View>
          )}

          {validMeds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medications / Plan</Text>
              {validMeds.map(med => (
                <DataPointRow key={med.id} item={med} icon="medkit-outline" onRecordTap={onRecordTap} />
              ))}
            </View>
          )}

          {validSymp.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Symptoms / Notes</Text>
              {validSymp.map(sym => (
                <DataPointRow key={sym.id} item={sym} icon="medical" onRecordTap={onRecordTap} />
              ))}
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function DataPointRow({ 
  item, 
  icon, 
  onRecordTap 
}: { 
  item: PatientDataPoint; 
  icon: keyof typeof Ionicons.glyphMap; 
  onRecordTap: (id: string) => void; 
}) {
  const dateObj = new Date(item.dateRecorded);
  const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.valueText}>{item.value}</Text>
        
        <View style={styles.metaRow}>
          <TouchableOpacity onPress={() => onRecordTap(item.recordId)} style={styles.metaTag}>
            <Ionicons name="image-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.metaText}>View Scan: {formattedDate}</Text>
          </TouchableOpacity>

          {item.isVerified && (
            <View style={styles.verifiedTag}>
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden', // to ensure content respects radius
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flex: 1,
  },
  diagnosisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  countText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  cardBody: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  valueText: {
    fontSize: 15,
    color: colors.foreground,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b98110',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#10b98140',
  },
  verifiedText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
});
