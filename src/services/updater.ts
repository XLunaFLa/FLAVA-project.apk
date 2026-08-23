/**
 * Service In-App Updater - FLAVA.
 * Mengecek versi terbaru dari update.json di repo GitHub.
 * Jika ada versi lebih baru: download APK -> buka installer (tanpa uninstall,
 * data user tetap aman).
 *
 * Cara merilis update baru:
 *   1. Naikkan "versionCode" & "version" di app.json
 *   2. Build APK: eas build -p android --profile preview
 *   3. Upload APK ke GitHub Releases (nama file sesuai apkUrl di update.json)
 *   4. Update angka versionCode/versionName/apkUrl di file update.json repo
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { writeVaultFile } from './storage';

/** Lokasi file versi terbaru (raw GitHub) */
const UPDATE_URL =
  'https://raw.githubusercontent.com/XLunaFLa/FLAVA-project.apk/main/update.json';

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
}

/** Ambil versi terbaru dari repo; return null jika tidak ada update / offline */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const currentVersionCode =
      Constants.expoConfig?.android?.versionCode ?? 1;

    // Cache-busting agar selalu dapat file terbaru
    const response = await fetch(`${UPDATE_URL}?t=${Date.now()}`);
    if (!response.ok) return null;

    const info = (await response.json()) as UpdateInfo;

    if (
      typeof info.versionCode === 'number' &&
      info.versionCode > currentVersionCode &&
      typeof info.apkUrl === 'string' &&
      info.apkUrl
    ) {
      return info;
    }
    return null;
  } catch {
    // Offline / repo tidak bisa diakses -> anggap tidak ada update
    return null;
  }
}

/**
 * Download APK update lalu buka installer Android.
 * APK disimpan juga ke folder FLAVA supaya bisa diakses user.
 */
export async function downloadAndInstallUpdate(
  info: UpdateInfo,
  onProgress?: (percent: number) => void
): Promise<void> {
  const apkName = `FLAVA-v${info.versionName}.apk`;
  const cacheUri = `${FileSystem.cacheDirectory}${apkName}`;

  // 1. Download APK ke cache dengan progress
  const resumable = FileSystem.createDownloadResumable(
    info.apkUrl,
    cacheUri,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      if (total > 0) {
        onProgress?.(
          Math.min(
            95,
            Math.round((progress.totalBytesWritten / total) * 100)
          )
        );
      }
    }
  );

  const result = await resumable.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`Download update gagal (HTTP ${result?.status ?? '?'})`);
  }
  onProgress?.(100);

  // 2. Simpan salinan ke folder FLAVA (via SAF - URI content:// yang aman)
  const base64 = await FileSystem.readAsStringAsync(result.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const savedUri = await writeVaultFile(
    apkName,
    'application/vnd.android.package-archive',
    base64
  );

  // 3. Bersihkan cache
  try {
    await FileSystem.deleteAsync(cacheUri, { idempotent: true });
  } catch {
    // abaikan
  }

  // 4. Buka installer Android (user tinggal tekan "Install")
  // ACTION_VIEW tidak ada di enum ActivityAction -> pakai string intent langsung
  await IntentLauncher.startActivityAsync(
    'android.intent.action.VIEW' as never,
    {
      data: savedUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    }
  );
}
