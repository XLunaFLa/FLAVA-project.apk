/**
 * Card untuk menampilkan satu link di dalam vault.
 * Aksi: buka link (tekan card), favorit, salin URL, hapus.
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
  /** Tekan card -> buka link ke aplikasi asli / browser */
  onPress: () => void;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export function LinkCard({
  item,
  categoryName,
  onPress,
  onToggleFavorite,
  onCopy,
  onDelete,
}: LinkCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Buka ${item.title}`}
    >
      {/* Thumbnail / fallback ikon vault */}
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailFallback]}>
          <Ionicons name="link" size={22} color={COLORS.accent} />
        </View>
      )}

      {/* Info utama */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.url} numberOfLines={1}>
          {item.url}
        </Text>
        <View style={styles.metaRow}>
          {categoryName ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{categoryName}</Text>
            </View>
          ) : null}
          {item.notes ? (
            <Ionicons
              name="document-text"
              size={12}
              color={COLORS.textDisabled}
            />
          ) : null}
        </View>
      </View>

      {/* Kolom aksi */}
      <View style={styles.actions}>
        <ActionIcon
          name={item.is_favorite ? 'star' : 'star-outline'}
          color={item.is_favorite ? COLORS.accent : COLORS.textSecondary}
          onPress={onToggleFavorite}
          label="Favorit"
        />
        <ActionIcon
          name="copy-outline"
          color={COLORS.textSecondary}
          onPress={onCopy}
          label="Salin URL"
        />
        <ActionIcon
          name="trash-outline"
          color={COLORS.danger}
          onPress={onDelete}
          label="Hapus"
        />
      </View>
    </TouchableOpacity>
  );
}

interface ActionIconProps {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  label: string;
}

function ActionIcon({ name, color, onPress, label }: ActionIconProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.actionButton}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={name} size={19} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.md,
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surface,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.xs,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  url: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 6,
  },
  categoryBadge: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.round,
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
  },
  categoryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  actions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  actionButton: {
    padding: 3,
  },
});
