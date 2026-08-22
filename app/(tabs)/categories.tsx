/**
 * Layar Categories - CRUD kategori kustom.
 * Pengguna bisa membuat, mengedit, dan menghapus kategori sendiri.
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { useToast } from '../../src/components/Toast';
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
} from '../../src/db/database';
import { Category } from '../../src/types';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

/** Palet warna untuk kategori baru */
const COLOR_PALETTE = [
  '#FFD600',
  '#4FC3F7',
  '#FF8A65',
  '#BA68C8',
  '#4CAF50',
  '#FF5252',
  '#FFB74D',
  '#64B5F6',
];

interface EditingState {
  id: number | null;
  name: string;
  color: string;
}

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<EditingState>({
    id: null,
    name: '',
    color: COLOR_PALETTE[0],
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setCategories(await getAllCategories());
    } catch {
      showToast('Gagal memuat kategori', 'error');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const openCreateModal = () => {
    setEditing({ id: null, name: '', color: COLOR_PALETTE[0] });
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditing({ id: category.id, name: category.name, color: category.color });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const name = editing.name.trim();
    if (!name) {
      showToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing.id != null) {
        await updateCategory(editing.id, name, editing.color);
        showToast('Kategori berhasil diperbarui', 'success');
      } else {
        await createCategory(name, editing.color);
        showToast('Kategori berhasil dibuat', 'success');
      }
      setModalVisible(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('UNIQUE')) {
        showToast('Kategori dengan nama itu sudah ada', 'error');
      } else {
        showToast('Gagal menyimpan kategori', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Hapus Kategori',
      `Yakin ingin menghapus kategori "${category.name}"?\n\nLink di dalamnya TIDAK ikut terhapus, hanya lepas dari kategori ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteCategory(category.id);
                showToast('Kategori berhasil dihapus', 'success');
                await loadData();
              } catch {
                showToast('Gagal menghapus kategori', 'error');
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={openCreateModal}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={24} color={COLORS.accent} />
        <Text style={styles.addButtonText}>Buat Kategori Baru</Text>
      </TouchableOpacity>

      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 40 },
        ]}
        renderItem={({ item }) => (
          <View style={styles.categoryCard}>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <Text style={styles.categoryName} numberOfLines={1}>
              {item.name}
            </Text>
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Edit kategori ${item.name}`}
            >
              <Ionicons
                name="pencil"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Hapus kategori ${item.name}`}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="grid-outline"
            title="Belum ada kategori"
            subtitle="Buat kategori untuk mengelompokkan link di vault kamu."
          />
        }
      />

      {/* Modal buat/edit kategori */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing.id != null ? 'Edit Kategori' : 'Kategori Baru'}
            </Text>

            <TextInput
              style={styles.nameInput}
              value={editing.name}
              onChangeText={(text) =>
                setEditing((prev) => ({ ...prev, name: text }))
              }
              placeholder="Nama kategori"
              placeholderTextColor={COLORS.textDisabled}
              maxLength={40}
              autoFocus
            />

            <Text style={styles.colorLabel}>Pilih warna</Text>
            <View style={styles.paletteRow}>
              {COLOR_PALETTE.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.paletteItem,
                    { backgroundColor: color },
                    editing.color === color && styles.paletteActive,
                  ]}
                  onPress={() =>
                    setEditing((prev) => ({ ...prev, color }))
                  }
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
  },
  addButtonText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: SPACING.md,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: SPACING.md,
  },
  categoryName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  iconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  separator: {
    height: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.xl,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  nameInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  colorLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  paletteItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  paletteActive: {
    borderWidth: 3,
    borderColor: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  modalButton: {
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.accent,
  },
  saveButtonText: {
    color: COLORS.accentText,
    fontWeight: '700',
  },
});
