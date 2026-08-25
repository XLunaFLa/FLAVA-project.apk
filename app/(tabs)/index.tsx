/**
 * Layar utama (Home) - FLa Vault Project.
 * v2: Tata letak 1-4 kolom (default 1), aksi card di baris bawah,
 * tombol Download video/audio, dan FAB menu vertikal.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
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
  getLayoutColumns,
  getLinks,
  setLayoutColumns,
  setLinkFavorite,
} from '../../src/db/database';
import { downloadAndSave } from '../../src/services/download';
import {
  ERR_STORAGE_PERMISSION,
  requestVaultAccess,
} from '../../src/services/storage';
import { Category, LinkItem } from '../../src/types';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

const VIDEO_QUALITIES = ['360', '480', '720', '1080'];
const AUDIO_BITRATES = ['128', '256', '320'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [numColumns, setNumColumns] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    name: string;
    percent: number | null;
    mb: number;
  } | null>(null);

  /** Muat kategori + daftar link + preferensi tata letak */
  const loadData = useCallback(async () => {
    try {
      await ensureSeedData();
      const [cats, items, savedColumns] = await Promise.all([
        getAllCategories(),
        getLinks({ search, categoryId: selectedCategoryId }),
        getLayoutColumns(),
      ]);
      setCategories(cats);
      setLinks(items);
      setNumColumns(savedColumns);
    } catch {
      showToast('Gagal memuat data dari database', 'error');
    }
  }, [search, selectedCategoryId, showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  /** Ganti jumlah kolom & simpan preferensinya */
  const handleChangeColumns = useCallback(
    (columns: number) => {
      setNumColumns(columns);
      void setLayoutColumns(columns).catch(() => {
        showToast('Gagal menyimpan preferensi tata letak', 'error');
      });
    },
    [showToast]
  );

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

  // ===== Download: pilih mode -> resolusi/bitrate -> unduh & simpan =====
  const startDownload = useCallback(
    (item: LinkItem, mode: 'video' | 'audio', detail: string) => {
      setDownloading(true);
      setDownloadProgress({ name: item.title, percent: 0, mb: 0 });
      showToast(
        mode === 'video'
          ? `Menyiapkan download video ${detail}p...`
          : `Menyiapkan download MP3 ${detail}kbps...`,
        'info'
      );
      void (async () => {
        try {
          await downloadAndSave(
            {
              sourceUrl: item.url,
              mode,
              videoQuality: mode === 'video' ? detail : undefined,
              audioBitrate: mode === 'audio' ? detail : undefined,
            },
            (progress) => {
              setDownloadProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      percent: progress.percent,
                      mb: progress.downloadedMb,
                    }
                  : prev
              );
            }
          );
          showToast('Download selesai! Cek folder FLAVA', 'success');
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Download gagal';
          if (message === ERR_STORAGE_PERMISSION) {
            // Folder vault belum dipilih -> tawarkan pilih folder
            Alert.alert(
              'Pilih Folder Penyimpanan',
              'Pilih lokasi untuk hasil download.\n\nCara: masuk ke Internal Storage → buat folder baru bernama "FLAVA" → tekan "Use this folder". Hanya sekali ini saja.',
              [
                { text: 'Nanti', style: 'cancel' },
                {
                  text: 'Pilih Folder',
                  onPress: () => {
                    void requestVaultAccess();
                  },
                },
              ]
            );
          } else {
            showToast(message, 'error');
          }
        } finally {
          setDownloading(false);
          setDownloadProgress(null);
        }
      })();
    },
    [showToast]
  );

  const handleDownload = useCallback(
    (item: LinkItem) => {
      if (downloading) {
        showToast('Masih ada download yang berjalan', 'info');
        return;
      }
      Alert.alert('Download Source', `Pilih format untuk:\n${item.title}`, [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Video (MP4)',
          onPress: () => {
            Alert.alert('Pilih Resolusi Video', undefined, [
              ...VIDEO_QUALITIES.map((q) => ({
                text: `${q}p`,
                onPress: () => startDownload(item, 'video', q),
              })),
              { text: 'Batal', style: 'cancel' },
            ]);
          },
        },
        {
          text: 'Audio (MP3)',
          onPress: () => {
            Alert.alert('Pilih Bitrate Audio', undefined, [
              ...AUDIO_BITRATES.map((b) => ({
                text: `${b} kbps`,
                onPress: () => startDownload(item, 'audio', b),
              })),
              { text: 'Batal', style: 'cancel' },
            ]);
          },
        },
      ]);
    },
    [downloading, showToast, startDownload]
  );

  const isGrid = numColumns > 1;

  return (
    <View style={styles.container}>
      <View style={[styles.controls, { paddingTop: SPACING.md }]}>
        <SearchBar value={search} onChangeText={setSearch} />
        <CategoryPills
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
        {/* Pengaturan tata letak 1-4 kolom */}
        <View style={styles.layoutRow}>
          <Text style={styles.layoutLabel}>Tata Letak</Text>
          <View style={styles.layoutOptions}>
            {[1, 2, 3, 4].map((columns) => (
              <TouchableOpacity
                key={columns}
                style={[
                  styles.layoutButton,
                  numColumns === columns && styles.layoutButtonActive,
                ]}
                onPress={() => handleChangeColumns(columns)}
                accessibilityLabel={`Tata letak ${columns} kolom`}
              >
                <Ionicons
                  name={columns === 1 ? 'list' : 'grid'}
                  size={16}
                  color={
                    numColumns === columns ? COLORS.accentText : COLORS.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.layoutButtonText,
                    numColumns === columns && styles.layoutButtonTextActive,
                  ]}
                >
                  {columns}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Banner progress download */}
      {downloadProgress ? (
        <View style={styles.progressBanner}>
          <View style={styles.progressHeader}>
            <Ionicons name="download" size={16} color={COLORS.accent} />
            <Text style={styles.progressTitle} numberOfLines={1}>
              {downloadProgress.name}
            </Text>
            <Text style={styles.progressPercent}>
              {downloadProgress.percent != null
                ? `${downloadProgress.percent}%`
                : `${downloadProgress.mb} MB`}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    downloadProgress.percent != null
                      ? `${downloadProgress.percent}%`
                      : '50%',
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <FlatList
        key={`grid-${numColumns}`}
        numColumns={numColumns}
        data={links}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          isGrid && styles.listGrid,
          { paddingBottom: insets.bottom + 120 },
        ]}
        columnWrapperStyle={isGrid ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <View style={isGrid ? styles.gridItem : styles.listItem}>
            <LinkCard
              item={item}
              variant={isGrid ? 'grid' : 'list'}
              categoryName={
                item.category_id != null
                  ? categoryNameById.get(item.category_id) ?? null
                  : null
              }
              onPress={() => handleOpenLink(item.url)}
              onToggleFavorite={() => handleToggleFavorite(item)}
              onDownload={() => handleDownload(item)}
              onCopy={() => handleCopyLink(item.url)}
              onDelete={() => handleDeleteLink(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="lock-closed-outline"
            title="Vault masih kosong"
            subtitle="Tekan tombol + kuning di kanan bawah untuk menyimpan link pertamamu."
          />
        }
      />

      {/* FAB Plus kuning dengan menu vertikal */}
      <FAB />
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
  layoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  layoutLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  layoutOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  layoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.round,
    paddingVertical: 5,
    paddingHorizontal: SPACING.md,
  },
  layoutButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  layoutButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  layoutButtonTextActive: {
    color: COLORS.accentText,
  },
  progressBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADII.md,
    padding: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  progressPercent: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  listGrid: {
    paddingHorizontal: SPACING.md,
  },
  listItem: {
    flex: 1,
    marginBottom: SPACING.md,
  },
  gridItem: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.md,
  },
  columnWrapper: {
    gap: 0,
  },
});
