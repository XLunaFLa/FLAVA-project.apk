/**
 * Form Tambah Link - FLa Vault Project.
 * 1. User memasukkan URL -> metadata (judul + thumbnail) ditarik otomatis
 *    via Microlink.io.
 * 2. Jika gagal (offline/API error), tersedia input manual sebagai fallback
 *    + toast notification.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToast } from '../src/components/Toast';
import { insertLink, getAllCategories } from '../src/db/database';
import { fetchMetadata } from '../src/services/metadata';
import { Category } from '../src/types';
import { isValidUrl } from '../src/utils/validation';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../constants/theme';

export default function AddLinkScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ url?: string | string[] }>();

  const [url, setUrl] = useState(
    typeof params.url === 'string' ? params.url : ''
  );
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Muat daftar kategori untuk pemilihan
  useEffect(() => {
    void (async () => {
      try {
        setCategories(await getAllCategories());
      } catch {
        showToast('Gagal memuat kategori', 'error');
      }
    })();
  }, [showToast]);

  // Jika dibuka via share intent (URL sudah terisi), langsung tarik metadata
  useEffect(() => {
    if (url.trim()) {
      void handleFetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Tarik judul & thumbnail otomatis (Microlink -> oEmbed -> favicon) */
  const handleFetchMetadata = async (targetUrl?: string) => {
    const source = targetUrl ?? url;
    if (!isValidUrl(source)) {
      showToast('URL tidak valid. Gunakan format http:// atau https://', 'error');
      return;
    }

    setFetching(true);
    try {
      const metadata = await fetchMetadata(source.trim());
      if (metadata.title && !title.trim()) {
        setTitle(metadata.title);
      }
      if (metadata.thumbnail) {
        setThumbnail(metadata.thumbnail);
      }
      showToast('Metadata berhasil ditarik otomatis', 'success');
    } catch (error) {
      showToast(
        error instanceof Error
          ? `${error.message} Isi judul secara manual sebagai cadangan.`
          : 'Gagal menarik metadata. Isi judul secara manual.',
        'error'
      );
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!isValidUrl(url)) {
      showToast('URL tidak valid. Gunakan format http:// atau https://', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Judul wajib diisi (otomatis atau manual)', 'error');
      return;
    }

    setSaving(true);
    try {
      await insertLink({
        url,
        title,
        thumbnail,
        notes: notes.trim() || null,
        categoryId: selectedCategoryId,
      });
      showToast('Link berhasil disimpan ke vault', 'success');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('UNIQUE')) {
        showToast('Link ini sudah ada di dalam vault', 'error');
      } else {
        showToast('Gagal menyimpan link', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  /** Paste URL dari clipboard lalu otomatis tarik metadata */
  const handlePaste = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (!clipboardText.trim()) {
        showToast('Clipboard kosong. Salin link terlebih dahulu.', 'error');
        return;
      }
      setUrl(clipboardText.trim());
      await handleFetchMetadata(clipboardText.trim());
    } catch {
      showToast('Gagal membaca clipboard', 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Input URL */}
        <Text style={styles.label}>URL Link *</Text>
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, styles.urlInput]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://contoh.com/artikel"
            placeholderTextColor={COLORS.textDisabled}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />
          {/* Tombol PASTE dari clipboard (kuning) */}
          <TouchableOpacity
            style={styles.fetchButton}
            onPress={() => void handlePaste()}
            disabled={fetching}
            activeOpacity={0.8}
            accessibilityLabel="Paste link dari clipboard"
          >
            {fetching ? (
              <ActivityIndicator size="small" color={COLORS.accentText} />
            ) : (
              <Ionicons name="clipboard" size={22} color={COLORS.accentText} />
            )}
          </TouchableOpacity>
          {/* Tombol kecil: tarik ulang metadata */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => void handleFetchMetadata()}
            disabled={fetching}
            activeOpacity={0.8}
            accessibilityLabel="Tarik ulang metadata"
          >
            <Ionicons name="cloud-download-outline" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Tekan ikon clipboard untuk PASTE dari clipboard. Metadata (judul &
          thumbnail) ditarik otomatis; ikon awan untuk menarik ulang.
        </Text>

        {/* Preview thumbnail */}
        {thumbnail ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: thumbnail }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removePreview}
              onPress={() => setThumbnail(null)}
              accessibilityLabel="Hapus thumbnail"
            >
              <Ionicons name="close-circle" size={22} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Judul - fallback manual jika API gagal */}
        <Text style={styles.label}>Judul * (bisa diedit manual)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Judul link (otomatis dari API atau isi manual)"
          placeholderTextColor={COLORS.textDisabled}
          maxLength={200}
        />

        {/* Catatan */}
        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Catatan pribadi tentang link ini..."
          placeholderTextColor={COLORS.textDisabled}
          multiline
          textAlignVertical="top"
        />

        {/* Pilih kategori */}
        <Text style={styles.label}>Kategori</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategoryId === null && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategoryId === null && styles.categoryChipTextActive,
              ]}
            >
              Tanpa Kategori
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategoryId === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategoryId(category.id)}
            >
              <View
                style={[styles.chipDot, { backgroundColor: category.color }]}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategoryId === category.id &&
                    styles.categoryChipTextActive,
                ]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tombol simpan */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => void handleSave()}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.accentText} />
          ) : (
            <Ionicons name="lock-closed" size={18} color={COLORS.accentText} />
          )}
          <Text style={styles.saveButtonText}>
            {saving ? 'Menyimpan...' : 'Simpan ke Vault'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + 20,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  urlInput: {
    flex: 1,
    maxHeight: 90,
  },
  fetchButton: {
    width: 48,
    height: 48,
    borderRadius: RADII.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  hint: {
    color: COLORS.textDisabled,
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
    marginTop: SPACING.sm,
  },
  previewWrap: {
    marginTop: SPACING.lg,
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 120,
    height: 68,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  removePreview: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.background,
    borderRadius: 11,
  },
  notesInput: {
    height: 90,
    paddingTop: SPACING.md,
  },
  categoryRow: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.round,
    paddingVertical: 8,
    paddingHorizontal: SPACING.lg,
  },
  categoryChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  categoryChipTextActive: {
    color: COLORS.accentText,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADII.md,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xxl,
  },
  saveButtonText: {
    color: COLORS.accentText,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
  },
});
