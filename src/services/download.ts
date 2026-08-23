/**
 * Service Download Media - FLa Vault Project.
 * Menyiapkan link unduhan video (MP4) / audio (MP3) via API Cobalt,
 * lalu menyimpannya langsung ke folder "FLa Vault" di internal storage
 * dengan progress callback + notifikasi sistem saat selesai.
 */

// SDK 57: API klasik (downloadAsync/DownloadResumable) ada di subpath 'legacy'
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { writeVaultFile } from './storage';

// Tampilkan notifikasi download selesai sebagai banner + di list notifikasi
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Instance komunitas aktif & terbuka (terverifikasi berfungsi tanpa key).
// Bisa diganti kapan saja via env EXPO_PUBLIC_COBALT_API_URL.
const COBALT_BASE_URL =
  process.env.EXPO_PUBLIC_COBALT_API_URL ?? 'https://co.otomir23.me/';

/**
 * API key untuk instance Cobalt yang membutuhkan autentikasi.
 * Format header Cobalt v10: "Authorization: Api-Key <key>"
 */
const COBALT_API_KEY = process.env.EXPO_PUBLIC_COBALT_API_KEY ?? '';

export type DownloadMode = 'video' | 'audio';

export interface DownloadRequest {
  sourceUrl: string;
  mode: DownloadMode;
  /** Resolusi video: '360' | '480' | '720' | '1080' */
  videoQuality?: string;
  /** Bitrate audio MP3: '128' | '256' | '320' */
  audioBitrate?: string;
}

export interface DownloadProgress {
  /** 0 - 100 */
  percent: number;
}

interface CobaltResponse {
  status?:
    | 'tunnel'
    | 'redirect'
    | 'error'
    | 'picker'
    | 'local-processing';
  url?: string;
  filename?: string;
  tunnel?: string[];
  output?: { filename?: string };
  error?: { code?: string };
}

/** Minta izin notifikasi (Android 13+) - dipanggil saat pertama buka app */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

/** Kirim notifikasi sistem bahwa download selesai */
export async function notifyDownloadComplete(
  filename: string,
  isAudio: boolean
): Promise<void> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download selesai ✅',
        body: `${filename}\nDisimpan di FLAVA/${isAudio ? 'Audio' : 'Video'}`,
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // Notifikasi gagal tidak boleh menggagalkan download
  }
}

/** Minta Cobalt menyiapkan link unduhan langsung dari source URL */
export async function resolveMediaUrl(
  request: DownloadRequest
): Promise<{ downloadUrl: string; filename: string }> {
  const payload: Record<string, unknown> = {
    url: request.sourceUrl,
    downloadMode: request.mode === 'audio' ? 'audio' : 'auto',
    filenameStyle: 'pretty',
    // PENTING: paksa server meremux/menggabungkan file sebelum dikirim.
    // Tanpa ini, beberapa platform (mis. YouTube) mengembalikan status
    // local-processing berupa stream terpisah yang tidak bisa diputar.
    alwaysProxy: true,
  };

  if (request.mode === 'video') {
    payload.videoQuality = request.videoQuality ?? '720';
  } else {
    payload.audioFormat = 'mp3';
    payload.audioBitrate = request.audioBitrate ?? '128';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (COBALT_API_KEY) {
    headers.Authorization = `Api-Key ${COBALT_API_KEY}`;
  }

  const response = await fetch(COBALT_BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Server download menolak permintaan (butuh API key). Atur EXPO_PUBLIC_COBALT_API_URL ke instance Cobalt milikmu.'
      );
    }
    throw new Error(`Server download error (HTTP ${response.status})`);
  }

  const json = (await response.json()) as CobaltResponse;

  // tunnel/redirect: link unduhan langsung
  if ((json.status === 'tunnel' || json.status === 'redirect') && json.url) {
    return {
      downloadUrl: json.url,
      filename: json.filename ?? `fla-vault-${Date.now()}.mp4`,
    };
  }

  // local-processing: cobalt memberi beberapa file tunnel yang harus
  // digabung sendiri - kita ambil file pertama sebagai fallback praktis
  if (json.status === 'local-processing' && json.tunnel?.length) {
    return {
      downloadUrl: json.tunnel[0],
      filename: json.output?.filename ?? `fla-vault-${Date.now()}.mp4`,
    };
  }

  // picker: konten multi-item (slideshow TikTok/dll) - belum didukung UI picker
  if (json.status === 'picker') {
    throw new Error(
      'Link ini berisi beberapa media (slideshow). Download per-item belum didukung.'
    );
  }

  const errorCode = json.error?.code;
  if (errorCode === 'unsupported_service' || errorCode === 'unsupported') {
    throw new Error('Platform dari link ini belum didukung server download');
  }
  if (
    errorCode === 'content.video.unavailable' ||
    errorCode === 'content.post.private'
  ) {
    throw new Error('Konten tidak tersedia atau bersifat privat');
  }
  throw new Error(errorCode ?? 'Gagal menyiapkan unduhan');
}

/**
 * Download file langsung ke folder "FLa Vault" di internal storage.
 * Progress dilaporkan via onProgress (0-100).
 * Return path lengkap file yang tersimpan.
 */
export async function downloadAndSave(
  request: DownloadRequest,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  const { downloadUrl, filename } = await resolveMediaUrl(request);
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  const isAudio = request.mode === 'audio';
  const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const cacheUri = `${FileSystem.cacheDirectory}${safeName}`;

  // 1. Unduh ke cache dengan progress
  const resumable = FileSystem.createDownloadResumable(
    downloadUrl,
    cacheUri,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      if (total > 0) {
        onProgress?.({
          percent: Math.min(
            95,
            Math.round((progress.totalBytesWritten / total) * 100)
          ),
        });
      }
    }
  );

  const result = await resumable.downloadAsync();

  if (!result || result.status !== 200) {
    // Bersihkan file parsial yang gagal
    try {
      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    } catch {
      // abaikan
    }
    throw new Error(
      `Download gagal (HTTP ${result?.status ?? 'unknown'})`
    );
  }

  // 2. Pindahkan ke folder "FLa Vault" (SAF)
  onProgress?.({ percent: 96 });
  const base64 = await FileSystem.readAsStringAsync(cacheUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const savedUri = await writeVaultFile(safeName, mimeType, base64);

  // 3. Bersihkan cache
  try {
    await FileSystem.deleteAsync(cacheUri, { idempotent: true });
  } catch {
    // abaikan
  }

  onProgress?.({ percent: 100 });
  await notifyDownloadComplete(safeName, isAudio);
  return savedUri;
}
