/**
 * Card untuk menampilkan satu link di dalam vault.
 * v2: Aksi dipindah ke BARIS BAWAH (lebih besar & mudah diklik)
 * dan mendukung 2 varian: 'list' (1 kolom) & 'grid' (2-4 kolom).
 * Aksi: favorit, download, salin URL, hapus. Tekan card -> buka link.
 */

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinkItem } from '../types';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

interface LinkCardProps {
  item: LinkItem;
  categoryName?: string | null;
  /** 'list' = kartu lebar penuh, 'grid' = ringkas untuk 2-4 kolom */
  variant?: 'list' | 'grid';
  /** Tekan card -> buka link ke aplikasi asli / browser */
  onPress: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export function LinkCard({
  item,
  categoryName,
  variant = 'list',
  onPress,
  onToggleFavorite,
  onDownload,
  onCopy,
  onDelete,
}: LinkCardProps) {
  const isGrid = variant === 'grid';

  return (
    <TouchableOpacity
      style={[styles.card, isGrid && styles.cardGrid]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Buka ${item.title}`}
    >
      {/* ===== Bagian info ===== */}
      <View style={isGrid ? styles.infoGrid : styles.infoList}>
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={isGrid ? styles.thumbnailGrid : styles.thumbnail}
          />
        ) : (
          <View
            style={[
              isGrid ? styles.thumbnailGrid : styles.thumbnail,
              styles.thumbnailFallback,
            ]}
          >
            <Ionicons name="link" size={isGrid ? 20 : 22} color={COLORS.accent} />
          </View>
        )}

        <View style={styles.textWrap}>
          <Text
            style={[styles.title, isGrid && styles.titleGrid]}
            numberOfLines={isGrid ? 2 : 2}
          >
            {item.title}
          </Text>
          {!isGrid ? (
            <Text style={styles.url} numberOfLines={1}>
              {item.url}
            </Text>
          ) : null}
          {categoryName ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{categoryName}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ===== Baris aksi di BAWAH (besar & mudah diklik) ===== */}
      <View style={styles.actionRow}>
        <ActionButton
          icon={item.is_favorite ? 'star' : 'star-outline'}
          label="Favorit"
          color={item.is_favorite ? COLORS.accent : COLORS.textSecondary}
          onPress={onToggleFavorite}
        />
        <ActionButton
          icon="download-outline"
          label="Download"
          color={COLORS.success}
          onPress={onDownload}
        />
        <ActionButton
          icon="copy-outline"
          label="Salin"
          color={COLORS.textSecondary}
          onPress={onCopy}
        />
        <ActionButton
          icon="trash-outline"
          label="Hapus"
          color={COLORS.danger}
          onPress={onDelete}
        />
      </View>
    </TouchableOpacity>
  );
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

function ActionButton({ icon, label, color, onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.md,
  },
  cardGrid: {
    padding: SPACING.sm,
  },
  // --- Varian list ---
  infoList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
  },
  // --- Varian grid ---
  infoGrid: {},
  thumbnailGrid: {
    width: '100%',
    height: 90,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textWrap: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  titleGrid: {
    marginLeft: 0,
    fontSize: FONT_SIZES.sm,
    lineHeight: 18,
  },
  url: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.round,
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    marginTop: 6,
  },
  categoryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  // --- Baris aksi bawah ---
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
  },
  actionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    marginTop: 2,
  },
});
