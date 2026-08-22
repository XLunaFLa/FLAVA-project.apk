/**
 * Floating Action Button (FAB) kuning untuk "Tambah Link".
 * Diposisikan absolute di kanan bawah, TEPAT DI ATAS bottom navigation bar.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADII } from '../../constants/theme';

/** Tinggi default tab bar + margin aman agar FAB tidak tertutup nav bar */
const TAB_BAR_HEIGHT = 56;

interface FABProps {
  onPress: () => void;
}

export function FAB({ onPress }: FABProps) {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          // Posisi tepat di atas bottom navigation bar (+ safe area bawah)
          bottom: TAB_BAR_HEIGHT + insets.bottom + 16,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Tambah link baru"
    >
      <Ionicons name="add" size={30} color={COLORS.accentText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: RADII.round,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 100,
  },
});
