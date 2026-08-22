/**
 * Layar Settings - FLa Vault Project.
 * Berisi: akun Google, Backup & Restore ke Google Drive, dan statistik vault.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/services/auth';
import { useToast } from '../../src/components/Toast';
import {
  downloadBackup,
  findBackupFile,
  uploadBackup,
} from '../../src/services/drive';
import {
  ensureSeedData,
  exportAllData,
  getStats,
  restoreFromBackup,
} from '../../src/db/database';
import { RestoreResult, VaultStats } from '../../src/types';
import { APP_NAME, COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

export default function SettingsScreen() {
  const { user, accessToken, loading, signIn, signOut } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState<VaultStats>({
    totalLinks: 0,
    totalFavorites: 0,
    totalCategories: 0,
  });
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      await ensureSeedData();
      setStats(await getStats());
    } catch {
      showToast('Gagal memuat statistik vault', 'error');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats])
  );

  // Cek waktu backup terakhir saat user sudah login
  useEffect(() => {
    if (!accessToken) {
      setLastBackupTime(null);
      return;
    }
    void (async () => {
      try {
        const file = await findBackupFile(accessToken);
        setLastBackupTime(file?.modifiedTime ?? null);
      } catch {
        // Diamkan saja - kemungkinan token kedaluwarsa atau belum ada backup
      }
    })();
  }, [accessToken]);

  const handleBackup = async () => {
    if (!accessToken) {
      showToast('Login dengan Google terlebih dahulu', 'error');
      return;
    }

    setBackingUp(true);
    try {
      const payload = await exportAllData();
      await uploadBackup(accessToken, payload);

      const file = await findBackupFile(accessToken);
      setLastBackupTime(file?.modifiedTime ?? null);
      showToast(
        `Backup berhasil: ${payload.links.length} link & ${payload.categories.length} kategori tersimpan di Google Drive`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Backup gagal',
        'error'
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = () => {
    if (!accessToken) {
      showToast('Login dengan Google terlebih dahulu', 'error');
      return;
    }

    Alert.alert(
      'Restore Data',
      'Data dari Google Drive akan digabungkan (merge) dengan data lokal di HP ini. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: () => void doRestore(),
        },
      ]
    );
  };

  const doRestore = async () => {
    setRestoring(true);
    try {
      const payload = await downloadBackup(accessToken as string);
      const result: RestoreResult = await restoreFromBackup(payload);
      await loadStats();
      showToast(
        `Restore selesai: ${result.linksRestored} link & ${result.categoriesRestored} kategori dipulihkan`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Restore gagal',
        'error'
      );
    } finally {
      setRestoring(false);
    }
  };

  const formatBackupTime = (isoTime: string): string => {
    try {
      return new Date(isoTime).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoTime;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 40 },
      ]}
    >
      {/* ===== Bagian Akun ===== */}
      <Text style={styles.sectionTitle}>Akun</Text>
      <View style={styles.card}>
        {user ? (
          <View style={styles.accountRow}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={22} color={COLORS.accent} />
              </View>
            )}
            <View style={styles.accountInfo}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => void signOut()}
              accessibilityLabel="Keluar dari akun Google"
            >
              <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loginBox}>
            <Ionicons name="cloud-offline-outline" size={28} color={COLORS.textSecondary} />
            <Text style={styles.loginText}>
              Masuk dengan Google untuk mengaktifkan Backup & Restore ke
              Google Drive.
            </Text>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => void signIn()}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.accentText} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={COLORS.accentText} />
                  <Text style={styles.googleButtonText}>Masuk dengan Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ===== Bagian Backup & Restore ===== */}
      <Text style={styles.sectionTitle}>Backup & Restore</Text>
      <View style={styles.card}>
        <View style={styles.backupStatusRow}>
          <Ionicons name="cloud-done-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.backupStatusText}>
            {lastBackupTime
              ? `Backup terakhir: ${formatBackupTime(lastBackupTime)}`
              : 'Belum pernah backup ke Google Drive'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, styles.backupButton]}
          onPress={() => void handleBackup()}
          disabled={backingUp}
          activeOpacity={0.8}
        >
          {backingUp ? (
            <ActivityIndicator size="small" color={COLORS.accentText} />
          ) : (
            <Ionicons name="cloud-upload-outline" size={20} color={COLORS.accentText} />
          )}
          <Text style={styles.actionButtonText}>
            {backingUp ? 'Sedang backup...' : 'Backup ke Google Drive'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.restoreButton]}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.8}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={COLORS.textPrimary} />
          ) : (
            <Ionicons name="cloud-download-outline" size={20} color={COLORS.textPrimary} />
          )}
          <Text style={styles.restoreButtonText}>
            {restoring ? 'Sedang restore...' : 'Restore dari Google Drive'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hintText}>
          Backup berisi seluruh link & kategori. Restore akan menggabungkan
          data backup dengan data di perangkat ini - cocok saat pindah HP baru.
        </Text>
      </View>

      {/* ===== Bagian Statistik ===== */}
      <Text style={styles.sectionTitle}>Statistik Vault</Text>
      <View style={styles.statsRow}>
        <StatCard icon="link" label="Total Link" value={stats.totalLinks} />
        <StatCard icon="star" label="Favorit" value={stats.totalFavorites} />
        <StatCard icon="grid" label="Kategori" value={stats.totalCategories} />
      </View>

      {/* ===== Footer ===== */}
      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={16} color={COLORS.textDisabled} />
        <Text style={styles.footerText}>
          {APP_NAME} v1.0.0 - Data tersimpan lokal (offline-first) & bisa
          dicadangkan ke Google Drive.
        </Text>
      </View>
    </ScrollView>
  );
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={COLORS.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.lg,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  accountName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  accountEmail: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  signOutButton: {
    padding: SPACING.sm,
  },
  loginBox: {
    alignItems: 'center',
  },
  loginText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  googleButtonText: {
    color: COLORS.accentText,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  backupStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  backupStatusText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  backupButton: {
    backgroundColor: COLORS.accent,
  },
  actionButtonText: {
    color: COLORS.accentText,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  restoreButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 0,
  },
  restoreButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  hintText: {
    color: COLORS.textDisabled,
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    marginTop: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.lg,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    marginTop: SPACING.sm,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.sm,
  },
  footerText: {
    flex: 1,
    color: COLORS.textDisabled,
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
  },
});
