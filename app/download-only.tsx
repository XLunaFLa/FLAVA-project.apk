/**
 * Layar Download Only - FLAVA.
 * Tempel link dari sosial media / website yang berisi video atau audio,
 * pilih format, lalu langsung download ke folder FLAVA.
 * Link TIDAK disimpan ke vault - murni downloader.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '../src/components/Toast';
import { fetchMetadata } from '../src/services/metadata';
import { downloadAndSave } from '../src/services/download';
import { isValidUrl } from '../src/utils/validation';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../constants/theme';

const VIDEO_QUALITIES = ['360', '480', '720', '1080'];
const AUDIO_BITRATES = ['128', '256', '320'];

type Mode = 'video' | 'audio';

export default function DownloadOnlyScreen() {
  const { showToast } = useToast();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('video');
  const [quality, setQuality] = useState('720');
  const [bitrate, setBitrate] = useState('320');
  const [fetching, setFetching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Tarik metadata judul untuk preview (gagal = tidak masalah, hanya preview)
  const loadPreview = async (targetUrl: string) => {
    if (!isValidUrl(targetUrl)) return;
    setFetching(true);
    try {
      const meta = await fetchMetadata(targetUrl.trim());
      if (meta.title) setTitle(meta.title);
    } catch {
      // Preview gagal tidak menghalangi download
    } finally {
      setFetching(false);
    }
  };

  /** Paste dari clipboard lalu tarik preview judul */
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        showToast('Clipboard kosong. Salin link terlebih dahulu.', 'error');
        return;
      }
      setUrl(text.trim());
      await loadPreview(text.trim());
    } catch {
      showToast('Gagal membaca clipboard', 'error');
    }
  };

  const handleDownload = async () => {
    if (!isValidUrl(url)) {
      showToast('URL tidak valid. Gunakan format http:// atau https://', 'error');
      return;
    }
    if (downloading) return;

    setDownloading(true);
    setProgress(0);
    showToast(
      mode === 'video'
        ? `Menyiapkan download video ${quality}p...`
        : `Menyiapkan download MP3 ${bitrate}kbps...`,
      'info'
    );

    try {
      await downloadAndSave(
        {
          sourceUrl: url.trim(),
          mode,
          videoQuality: mode === 'video' ? quality : undefined,
          audioBitrate: mode === 'audio' ? bitrate : undefined,
        },
        (p) => setProgress(p.percent)
      );
      showToast('Download selesai! Cek folder FLAVA', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Download gagal',
        'error'
      );
    } finally {
      setDownloading(false);
      setProgress(0);
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
        {/* Input URL + tombol paste */}
        <Text style={styles.label}>Link Video / Audio *</Text>
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, styles.urlInput]}
            value={url}
            onChangeText={setUrl}
            placeholder="Tempel link TikTok / IG / YouTube / website..."
            placeholderTextColor={COLORS.textDisabled}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />
          <TouchableOpacity
            style={styles.pasteButton}
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
        </View>
        <Text style={styles.hint}>
          Tekan ikon clipboard untuk paste dari clipboard. Judul ditarik
          otomatis sebagai preview.
        </Text>

        {/* Preview judul */}
        {title ? (
          <View style={styles.previewBox}>
            <Ionicons name="film-outline" size={18} color={COLORS.accent} />
            <Text style={styles.previewText} numberOfLines={2}>
              {title}
            </Text>
          </View>
        ) : null}

        {/* Pilih format */}
        <Text style={styles.label}>Format</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'video' && styles.chipActive]}
            onPress={() => setMode('video')}
          >
            <Ionicons
              name="videocam"
              size={18}
              color={mode === 'video' ? COLORS.accentText : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeText,
                mode === 'video' && styles.modeTextActive,
              ]}
            >
              Video (MP4)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'audio' && styles.chipActive]}
            onPress={() => setMode('audio')}
          >
            <Ionicons
              name="musical-notes"
              size={18}
              color={mode === 'audio' ? COLORS.accentText : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeText,
                mode === 'audio' && styles.modeTextActive,
              ]}
            >
              Audio (MP3)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pilihan kualitas */}
        <Text style={styles.label}>
          {mode === 'video' ? 'Resolusi Video' : 'Bitrate Audio'}
        </Text>
        <View style={styles.qualityRow}>
          {(mode === 'video' ? VIDEO_QUALITIES : AUDIO_BITRATES).map((value) => {
            const active =
              mode === 'video' ? quality === value : bitrate === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.qualityChip, active && styles.chipActive]}
                onPress={() =>
                  mode === 'video' ? setQuality(value) : setBitrate(value)
                }
              >
                <Text
                  style={[
                    styles.qualityText,
                    active && styles.modeTextActive,
                  ]}
                >
                  {mode === 'video' ? `${value}p` : `${value}k`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tombol download */}
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => void handleDownload()}
          disabled={downloading}
          activeOpacity={0.8}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={COLORS.accentText} />
          ) : (
            <Ionicons name="download" size={20} color={COLORS.accentText} />
          )}
          <Text style={styles.downloadButtonText}>
            {downloading
              ? `Mengunduh... ${progress}%`
              : 'Download Sekarang'}
          </Text>
        </TouchableOpacity>

        {/* Progress bar */}
        {downloading ? (
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
        ) : null}

        <Text style={styles.footerHint}>
          File disimpan ke folder FLAVA di penyimpanan internal kamu.
        </Text>
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
  pasteButton: {
    width: 48,
    height: 48,
    borderRadius: RADII.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: COLORS.textDisabled,
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
    marginTop: SPACING.sm,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  previewText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  modeText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  modeTextActive: {
    color: COLORS.accentText,
  },
  qualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  qualityChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.round,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    minWidth: 70,
    alignItems: 'center',
  },
  qualityText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADII.md,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xxl,
  },
  downloadButtonText: {
    color: COLORS.accentText,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    marginTop: SPACING.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  footerHint: {
    color: COLORS.textDisabled,
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
