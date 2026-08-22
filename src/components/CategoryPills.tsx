/**
 * Filter pills kategori - bisa digeser horizontal.
 * Pill pertama selalu "Semua" (selectedId = null).
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../types';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

interface CategoryPillsProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
}

export function CategoryPills({
  categories,
  selectedId,
  onSelect,
}: CategoryPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Pill "Semua" */}
      <Pill
        label="Semua"
        color={COLORS.accent}
        active={selectedId === null}
        onPress={() => onSelect(null)}
      />
      {categories.map((category) => (
        <Pill
          key={category.id}
          label={category.name}
          color={category.color}
          active={selectedId === category.id}
          onPress={() => onSelect(category.id)}
        />
      ))}
    </ScrollView>
  );
}

interface PillProps {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}

function Pill({ label, color, active, onPress }: PillProps) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text
        style={[
          styles.label,
          active ? styles.labelActive : styles.labelInactive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.round,
    paddingVertical: 7,
    paddingHorizontal: SPACING.lg,
  },
  pillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    maxWidth: 140,
  },
  labelActive: {
    color: COLORS.accentText,
    fontWeight: '700',
  },
  labelInactive: {
    color: COLORS.textSecondary,
  },
});
