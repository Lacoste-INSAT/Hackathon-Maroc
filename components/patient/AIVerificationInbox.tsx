import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { PendingVerificationItem } from '@/lib/types';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { LinearTransition, SlideOutLeft, FadeIn } from 'react-native-reanimated';

interface Props {
  items: PendingVerificationItem[];
  onApprove: (item: PendingVerificationItem) => void;
  onReject: (item: PendingVerificationItem) => void;
  onEdit: (item: PendingVerificationItem, newValue: string) => void;
}

export function AIVerificationInbox({ items, onApprove, onReject, onEdit }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="warning-outline" size={20} color={colors.destructive} />
        <Text style={styles.headerTitle}>
          {items.length} Pending AI Verification{items.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <Animated.View layout={LinearTransition.springify()} style={styles.listContainer}>
        {items.map(item => (
          <VerificationCard
            key={item.id}
            item={item}
            onApprove={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onApprove(item);
            }}
            onReject={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onReject(item);
            }}
            onEdit={(newValue) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEdit(item, newValue);
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function VerificationCard({
  item,
  onApprove,
  onReject,
  onEdit
}: {
  item: PendingVerificationItem;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (val: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.fieldValue);

  const handleSaveEdit = () => {
    if (editValue.trim() !== '') {
      onEdit(editValue);
      setIsEditing(false);
    }
  };

  return (
    <Animated.View 
      layout={LinearTransition.springify()} 
      entering={FadeIn}
      exiting={SlideOutLeft}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.fieldLabel}>{item.fieldLabel}</Text>
        <Text style={styles.confidenceScore}>
          Confidence: {item.confidence}%
        </Text>
      </View>

      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.textInput}
            value={editValue}
            onChangeText={setEditValue}
            autoFocus
            multiline
          />
          <View style={styles.editActions}>
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveEdit} style={styles.saveBtn}>
              <Text style={styles.saveTxt}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.fieldValue}>{item.fieldValue}</Text>
      )}

      {!isEditing && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={onReject}>
            <Ionicons name="close-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.actionTxt, { color: colors.destructive }]}>Reject</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => setIsEditing(true)}>
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionTxt, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={onApprove}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
            <Text style={[styles.actionTxt, { color: '#10b981' }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.destructive,
    marginLeft: spacing.sm,
  },
  listContainer: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.destructive + '40', // 40 hex is 25% opacity
    shadowColor: colors.destructive,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.foreground,
    textTransform: 'uppercase',
  },
  confidenceScore: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  fieldValue: {
    fontSize: 16,
    color: colors.foreground,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    gap: 4,
  },
  rejectBtn: {
    backgroundColor: colors.destructive + '15',
  },
  editBtn: {
    backgroundColor: colors.primaryLight,
  },
  approveBtn: {
    backgroundColor: '#10b98115', // light emerald
  },
  actionTxt: {
    fontSize: 14,
    fontWeight: '600',
  },
  editContainer: {
    marginTop: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelTxt: {
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  saveTxt: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
});
