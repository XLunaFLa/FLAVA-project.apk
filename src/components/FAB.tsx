/**
 * FAB Plus kuning dengan menu vertikal (speed dial).
 * Saat ditekan, muncul 4 opsi kecil ke ATAS:
 * Tambah Vault, Favorites, Categories, Settings.
 * Diposisikan kanan bawah, tepat di atas area aman layar.
 */

import React, { useState } from 'react';
import {
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  { icon: 'add-circle-outline', label: 'Tambah Vault', route: '/add-link' },
  { icon: 'download-outline', label: 'Download Only', route: '/download-only' },
  { icon: 'star-outline', label: 'Favorites', route: '/(tabs)/favorites' },
  { icon: 'grid-outline', label: 'Categories', route: '/(tabs)/categories' },
  { icon: 'settings-outline', label: 'Settings', route: '/(tabs)/settings' },
];

export function FAB() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  /** Ref agar BackHandler bisa membaca status terbaru tanpa re-run effect */
  const openRef = React.useRef(false);

  const toggleMenu = React.useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  // Reset menu HANYA saat layar kembali fokus (bukan saat state berubah),
  // plus tangani tombol back Android untuk menutup menu.
  useFocusEffect(
    React.useCallback(() => {
      openRef.current = false;
      setOpen(false);

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (openRef.current) {
            openRef.current = false;
            setOpen(false);
            return true;
          }
          return false;
        }
      );
      return () => subscription.remove();
    }, [])
  );

  const handleNavigate = (route: string) => {
    toggleMenu(false);
    router.push(route as never);
  };

  return (
    <>
      {/* Backdrop gelap saat menu terbuka */}
      {open ? (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />
      ) : null}

      {/* Menu opsi vertikal (muncul ke ATAS dari FAB) */}
      {open ? (
        <View
          style={[styles.menu, { bottom: 84 + insets.bottom }]}
          pointerEvents="box-none"
        >
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => handleNavigate(item.route)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.menuLabel}>{item.label}</Text>
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={20} color={COLORS.accent} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Tombol FAB utama */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        onPress={() => toggleMenu(!open)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Tutup menu' : 'Buka menu'}
      >
        <Ionicons
          name={open ? 'close' : 'add'}
          size={30}
          color={COLORS.accentText}
        />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 90,
  },
  menu: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: SPACING.md,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuLabel: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
  },
  menuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADII.round,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
