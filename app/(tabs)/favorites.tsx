/**
 * Layar Favorites - menampilkan semua link yang ditandai favorit.
 */

import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { LinkCard } from '../../src/components/LinkCard';
import { SearchBar } from '../../src/components/SearchBar';
import { useToast } from '../../src/components/Toast';
import {
  deleteLink,
  getAllCategories,
  getLinks,
  setLinkFavorite,
} from '../../src/db/database';
import { Category, LinkItem } from '../../src/types';
import { COLORS, SPACING } from '../../constants/theme';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [cats, items] = await Promise.all([
        getAllCategories(),
        getLinks({ search, favoritesOnly: true }),
      ]);
      setCategories(cats);
      setLinks(items);
    } catch {
      showToast('Gagal memuat data favorit', 'error');
    }
  }, [search, showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

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
        await setLinkFavorite(item.id, !item.is_favorite);
        // Setelah un-favorite, muat ulang agar card hilang dari daftar
        await loadData();
      } catch {
        showToast('Gagal mengubah status favorit', 'error');
      }
    },
    [loadData, showToast]
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
      <View style={[styles.searchWrap, { paddingTop: SPACING.md }]}>
        <SearchBar value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={links}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 40 },
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
            icon="star-outline"
            title="Belum ada favorit"
            subtitle="Tekan ikon bintang pada card link untuk menandainya sebagai favorit."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchWrap: {
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
