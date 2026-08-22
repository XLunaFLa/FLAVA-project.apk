/**
 * Layar utama (Home) - FLa Vault Project.
 * Berisi: search bar, filter pills kategori horizontal, daftar link,
 * dan FAB kuning "Tambah Link" di kanan bawah tepat di atas nav bar.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryPills } from '../../src/components/CategoryPills';
import { EmptyState } from '../../src/components/EmptyState';
import { FAB } from '../../src/components/FAB';
import { LinkCard } from '../../src/components/LinkCard';
import { SearchBar } from '../../src/components/SearchBar';
import { useToast } from '../../src/components/Toast';
import {
  deleteLink,
  ensureSeedData,
  getAllCategories,
  getLinks,
  setLinkFavorite,
} from '../../src/db/database';
import { Category, LinkItem } from '../../src/types';
import { COLORS, SPACING } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  /** Muat kategori + daftar link sesuai filter aktif */
  const loadData = useCallback(async () => {
    try {
      await ensureSeedData();
      const [cats, items] = await Promise.all([
        getAllCategories(),
        getLinks({ search, categoryId: selectedCategoryId }),
      ]);
      setCategories(cats);
      setLinks(items);
    } catch {
      showToast('Gagal memuat data dari database', 'error');
    }
  }, [search, selectedCategoryId, showToast]);

  // Muat ulang setiap kali layar ini kembali fokus (mis. setelah tambah link)
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  /** Peta id kategori -> nama untuk badge di card */
  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categories]);

  /** Deep linking: buka ke aplikasi asli (FB/IG/dll) atau browser bawaan */
  const handleOpenLink = useCallback(
    async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch {
        showToast('Tidak ada aplikasi yang bisa membuka link ini', 'error');
      }
    },
    [showToast]
  );

  const handleCopyLink = useCallback(
    async (url: string) => {
      try {
        await Clipboard.setStringAsync(url);
        showToast('URL berhasil disalin', 'success');
      } catch {
        showToast('Gagal menyalin URL', 'error');
      }
    },
    [showToast]
  );

  const handleToggleFavorite = useCallback(
    async (item: LinkItem) => {
      try {
        const nextValue = !item.is_favorite;
        await setLinkFavorite(item.id, nextValue);
        setLinks((prev) =>
          prev.map((link) =>
            link.id === item.id
              ? { ...link, is_favorite: nextValue ? 1 : 0 }
              : link
          )
        );
      } catch {
        showToast('Gagal mengubah status favorit', 'error');
      }
    },
    [showToast]
  );

  const handleDeleteLink = useCallback(
    (item: LinkItem) => {
      Alert.alert('Hapus Link', `Yakin ingin menghapus "${item.title}"?`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteLink(item.id);
                setLinks((prev) => prev.filter((link) => link.id !== item.id));
                showToast('Link berhasil dihapus', 'success');
              } catch {
                showToast('Gagal menghapus link', 'error');
              }
            })();
          },
        },
      ]);
    },
    [showToast]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.controls, { paddingTop: SPACING.md }]}>
        <SearchBar value={search} onChangeText={setSearch} />
        <CategoryPills
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      </View>

      <FlatList
        data={links}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        renderItem={({ item }) => (
          <LinkCard
            item={item}
            categoryName={
              item.category_id != null
                ? categoryNameById.get(item.category_id) ?? null
                : null
            }
            onPress={() => handleOpenLink(item.url)}
            onToggleFavorite={() => handleToggleFavorite(item)}
            onCopy={() => handleCopyLink(item.url)}
            onDelete={() => handleDeleteLink(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="lock-closed-outline"
            title="Vault masih kosong"
            subtitle="Tekan tombol + kuning di kanan bawah untuk menyimpan link pertamamu."
          />
        }
      />

      {/* FAB Tambah Link - kanan bawah, tepat di atas bottom navigation */}
      <FAB onPress={() => router.push('/add-link')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  controls: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  separator: {
    height: SPACING.md,
  },
});
