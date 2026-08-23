/**
 * Root layout - FLAVA.
 * Menyediakan provider global (Toast, Auth), menangani share intent,
 * dan mengecek update aplikasi saat startup.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { AuthProvider } from '../src/services/auth';
import { ToastProvider, useToast } from '../src/components/Toast';
import { COLORS } from '../constants/theme';
import { extractFirstUrl } from '../src/utils/validation';
import {
  ERR_STORAGE_PERMISSION,
  getVaultUri,
  requestVaultAccess,
} from '../src/services/storage';
import { ensureNotificationPermission } from '../src/services/download';
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  UpdateInfo,
} from '../src/services/updater';

export default function RootLayout() {
  const router = useRouter();

  // Alur PERTAMA KALI setelah install:
  // 1. Minta user memilih folder "FLa Vault" (sekali saja, izin permanen)
  // 2. Minta izin notifikasi (untuk info download selesai)
  useEffect(() => {
    void (async () => {
      try {
        await getVaultUri();
      } catch {
        Alert.alert(
          'Selamat Datang di FLAVA! 🎉',
          'Pilih lokasi penyimpanan untuk hasil download.\n\nCara: masuk ke Internal Storage → buat folder baru bernama "FLAVA" → tekan "Use this folder".\n\nIni hanya dilakukan SEKALI.',
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
      }
      await ensureNotificationPermission();
    })();
  }, []);
  /** Guard agar URL share yang sama tidak diproses dua kali */
  const lastProcessedUrl = useRef<string | null>(null);

  /**
   * Tangani URL yang masuk dari menu Share bawaan OS.
   * Teks yang dibagikan berisi URL -> langsung dibuka di form Tambah Link.
   */
  const handleIncomingUrl = useCallback(
    (incoming: string | null | undefined) => {
      if (!incoming || incoming.startsWith('flavault://')) return;
      if (incoming === lastProcessedUrl.current) return;

      const sharedUrl = extractFirstUrl(incoming);
      if (sharedUrl) {
        lastProcessedUrl.current = incoming;
        router.push({ pathname: '/add-link', params: { url: sharedUrl } });
      }
    },
    [router]
  );

  useEffect(() => {
    // URL saat aplikasi dibuka dari kondisi mati (cold start)
    void Linking.getInitialURL().then(handleIncomingUrl);

    // URL saat aplikasi sudah berjalan di background
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleIncomingUrl(url)
    );
    return () => subscription.remove();
  }, [handleIncomingUrl]);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <UpdateChecker />
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="add-link"
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Tambah Link',
                headerStyle: { backgroundColor: COLORS.surface },
                headerTintColor: COLORS.textPrimary,
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </Stack>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

/**
 * Cek update dari GitHub saat aplikasi dibuka (delay 5 detik agar
 * tidak mengganggu load awal). Jika ada versi baru, tawarkan download
 * & install langsung dari aplikasi.
 */
function UpdateChecker() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        const update = await checkForUpdate();
        if (!update) return;

        Alert.alert(
          'Update Tersedia 🎉',
          `Versi ${update.versionName} sekarang tersedia.${
            update.notes ? `\n\n${update.notes}` : ''
          }\n\nUpdate tanpa perlu uninstall - data kamu tetap aman.`,
          [
            { text: 'Nanti', style: 'cancel' },
            {
              text: 'Update Sekarang',
              onPress: () => {
                if (busy) return;
                setBusy(true);
                showToast('Mengunduh update...', 'info');
                void (async () => {
                  try {
                    await downloadAndInstallUpdate(update, (percent) => {
                      if (percent > 0 && percent % 25 === 0) {
                        showToast(`Mengunduh update ${percent}%`, 'info');
                      }
                    });
                  } catch (error) {
                    showToast(
                      error instanceof Error
                        ? error.message
                        : 'Update gagal',
                      'error'
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              },
            },
          ]
        );
      })();
    }, 5000);
    return () => clearTimeout(timer);
  }, [busy, showToast]);

  return null;
}
