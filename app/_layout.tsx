/**
 * Root layout - FLa Vault Project.
 * Menyediakan provider global (Toast, Auth) dan menangani
 * share intent dari aplikasi lain (Share Extension Android).
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { AuthProvider } from '../src/services/auth';
import { ToastProvider } from '../src/components/Toast';
import { COLORS } from '../constants/theme';
import { extractFirstUrl } from '../src/utils/validation';
import {
  ERR_STORAGE_PERMISSION,
  getVaultUri,
  requestVaultAccess,
} from '../src/services/storage';
import { ensureNotificationPermission } from '../src/services/download';

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
