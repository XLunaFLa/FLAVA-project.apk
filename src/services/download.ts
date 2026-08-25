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
// PENTING: nilai ini dipakai oleh SEMUA platform non-YouTube (TikTok
// fallback, IG, FB, dll lewat resolveMediaUrl) - dikembalikan persis
// seperti semula (default sebelum sesi perbaikan ini). Perbaikan
// khusus YouTube ada di YOUTUBE_COBALT_FALLBACK_URLS di bawah, yang
// SEPENUHNYA TERPISAH dan tidak menyentuh variabel ini sama sekali.
const COBALT_BASE_URL =
  process.env.EXPO_PUBLIC_COBALT_API_URL ?? 'https://co.otomir23.me/';

/**
 * Daftar instance Cobalt fallback KHUSUS untuk jalur YouTube di
 * downloadYouTubeWithFallback() - TIDAK terhubung ke / tidak
 * menggantikan COBALT_BASE_URL di atas, sehingga tidak ada efek
 * samping ke platform lain (TikTok/IG/FB/dll tetap 100% pakai
 * COBALT_BASE_URL asli seperti semula).
 * co.otomir23.me kadang menghasilkan tunnel basi khusus untuk YouTube
 * (bug "File 0 byte"); daftar berikut instance komunitas sehat & versi
 * terbaru (dicek via cobalt.directory) yang dicoba berurutan HANYA
 * saat resolve/download YouTube gagal atau hasilnya 0 byte.
 */
const YOUTUBE_COBALT_FALLBACK_URLS = [
  'https://co.otomir23.me/',
  'https://cobalt-api.lamps-dev.dev/',
  'https://bergung-api.hoffnungfuerdiezukunft.net/',
  'https://api.qwkuns.me/',
];

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
  /** 0-100, atau null jika total ukuran tidak diketahui (chunked stream) */
  percent: number | null;
  /** MB yang sudah terunduh */
  downloadedMb: number;
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

/**
 * Provider khusus YouTube via Piped API (gratis, tanpa key).
 * Piped = NewPipeExtractor sebagai layanan - pendekatan yang sama
 * dengan aplikasi NewPipe. Daftar instance fallback untuk keandalan.
 * CATATAN PENTING: YouTube bisa menolak request anonim kapan saja
 * dengan error "Sign in to confirm you're not a bot" tergantung status
 * IP instance saat itu - ini BUKAN jaminan selalu berhasil, sifatnya
 * usaha terbaik. Kalau gagal, otomatis fallback ke Cobalt.
 */
const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.kavin.rocks',
];

/** Fetch dengan timeout (AbortController) agar tidak menggantung selamanya */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Ekstrak videoId dari berbagai format URL YouTube */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function resolveViaPiped(
  sourceUrl: string,
  mode: DownloadMode,
  videoQuality?: string
): Promise<{ downloadUrl: string; filename: string } | null> {
  const videoId = extractYouTubeId(sourceUrl);
  if (!videoId) return null;

  for (const instance of PIPED_INSTANCES) {
    try {
      console.log('[FLAVA Download] Coba instance Piped:', instance);
      const response = await fetchWithTimeout(
        `${instance}/streams/${videoId}`,
        { headers: { Accept: 'application/json' } }
      );
      console.log('[FLAVA Download] Piped response:', response.status);
      if (!response.ok) continue;

      const json = await response.json();
      console.log(
        '[FLAVA Download] Piped OK. Combined streams:',
        (json.videoStreams ?? []).filter((s: { videoOnly?: boolean }) => !s.videoOnly).length,
        '| Audio streams:',
        (json.audioStreams ?? []).length
      );

      if (mode === 'audio') {
        // Pilih audio dengan bitrate tertinggi
        const audioStreams: Array<{
          url: string;
          bitrate?: number;
          format?: string;
        }> = json.audioStreams ?? [];
        const best = audioStreams
          .filter((s) => s.url)
          .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (!best) continue;
        const ext = best.format?.toLowerCase() === 'm4a' ? 'm4a' : 'mp3';
        return {
          downloadUrl: best.url,
          filename: `YouTube_Audio_${Date.now()}.${ext}`,
        };
      }

      // Video: pilih stream GABUNGAN (video+audio) dengan resolusi
      // tertinggi yang <= permintaan; fallback ke yang tertinggi lainnya
      const combined: Array<{
        url: string;
        quality?: string;
        videoOnly?: boolean;
        format?: string;
      }> = json.videoStreams ?? [];
      const withAudio = combined.filter((s) => s.url && !s.videoOnly);
      if (!withAudio.length) continue;

      const requested = parseInt(videoQuality ?? '720', 10) || 720;
      const parsed = withAudio
        .map((s) => ({
          stream: s,
          height: parseInt(s.quality ?? '0', 10) || 0,
        }))
        .sort((a, b) => b.height - a.height);

      const chosen =
        parsed.find((p) => p.height <= requested) ?? parsed[parsed.length - 1];

      return {
        downloadUrl: chosen.stream.url,
        filename: `YouTube_${chosen.stream.quality ?? requested}p_${Date.now()}.mp4`,
      };
    } catch {
      // Coba instance berikutnya
    }
  }
  return null;
}

/**
 * Provider khusus TikTok via tikwm.com (gratis, tanpa key).
 * Menyediakan file LANGSUNG dari CDN TikTok (tanpa konversi server),
 * sehingga tidak terpengaruh keterbatasan ffmpeg instance Cobalt.
 * Return null jika bukan link TikTok / gagal.
 */
async function resolveViaTikwm(
  sourceUrl: string,
  mode: DownloadMode
): Promise<{ downloadUrl: string; filename: string } | null> {
  if (!/tiktok\.com/i.test(sourceUrl)) return null;
  try {
    console.log('[FLAVA Download] Coba tikwm untuk TikTok...');
    const response = await fetchWithTimeout(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(sourceUrl)}&hd=1`
    );
    console.log('[FLAVA Download] tikwm response:', response.status);
    const json = await response.json();
    if (json.code !== 0 || !json.data) return null;

    if (mode === 'audio') {
      if (!json.data.music) return null;
      return {
        downloadUrl: json.data.music,
        filename: `TikTok_Audio_${Date.now()}.mp3`,
      };
    }
    const videoUrl = json.data.hdplay || json.data.play;
    if (!videoUrl) return null;
    return {
      downloadUrl: videoUrl,
      filename: `TikTok_Video_${Date.now()}.mp4`,
    };
  } catch {
    return null;
  }
}

/** Deteksi apakah source URL adalah YouTube (dipakai untuk pilih strategi unduh) */
function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

/** Bangun payload request Cobalt standar dari DownloadRequest */
function buildCobaltPayload(request: DownloadRequest): Record<string, unknown> {
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

  return payload;
}

/** Kirim satu request POST ke instance Cobalt tertentu dan parse hasilnya */
async function requestCobaltInstance(
  baseUrl: string,
  payload: Record<string, unknown>
): Promise<{ downloadUrl: string; filename: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (COBALT_API_KEY) {
    headers.Authorization = `Api-Key ${COBALT_API_KEY}`;
  }

  const response = await fetchWithTimeout(
    baseUrl,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    20_000
  );

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

/** Minta Cobalt menyiapkan link unduhan langsung dari source URL */
export async function resolveMediaUrl(
  request: DownloadRequest
): Promise<{ downloadUrl: string; filename: string }> {
  // Catatan: untuk YouTube, resolve dilakukan lewat jalur khusus
  // downloadYouTubeWithFallback() (Piped dulu, lalu fallback Cobalt),
  // BUKAN lewat fungsi ini - lihat downloadAndSave().

  // TikTok -> tikwm dulu (lebih andal), fallback ke Cobalt
  const tikwm = await resolveViaTikwm(request.sourceUrl, request.mode);
  if (tikwm) return tikwm;

  const payload = buildCobaltPayload(request);
  return requestCobaltInstance(COBALT_BASE_URL, payload);
}

/**
 * Khusus YouTube: coba resolve + download di satu instance Cobalt.
 * Return path file sementara (cache) jika berhasil DAN ukurannya > 0 byte.
 * Melempar error jika resolve gagal atau hasil unduhan 0 byte, sehingga
 * pemanggil (downloadYouTubeWithFallback) bisa lanjut ke instance berikutnya.
 */
async function tryDownloadYouTubeFromInstance(
  baseUrl: string,
  request: DownloadRequest,
  cacheUri: string,
  downloadHeaders: Record<string, string>
): Promise<{ filename: string }> {
  const payload = buildCobaltPayload(request);
  console.log('[FLAVA Download] YouTube: resolve via instance', baseUrl);
  const { downloadUrl, filename } = await requestCobaltInstance(baseUrl, payload);
  console.log('[FLAVA Download] YouTube: resolve OK, mulai unduh dari tunnel...');

  // Tunnel Cobalt untuk YouTube mengirim body ter-chunk TANPA header
  // Content-Length pasti (hanya header custom Estimated-Content-Length).
  // FileSystem.createDownloadResumable (native downloader) pada kondisi
  // ini menghasilkan file 0 byte secara diam-diam untuk kasus ini.
  // FileSystem.downloadAsync (non-resumable, sekali panggil) tetap
  // membaca seluruh body dari response OkHttp/URLSession secara
  // langsung ke file tanpa bergantung pada Content-Length, jadi
  // dipakai khusus di sini sebagai pengganti createDownloadResumable.
  const result = await FileSystem.downloadAsync(downloadUrl, cacheUri, {
    headers: downloadHeaders,
  });
  if (!result || result.status !== 200) {
    throw new Error(`Download gagal (HTTP ${result?.status ?? 'unknown'})`);
  }
  const info = await FileSystem.getInfoAsync(cacheUri);
  const fileSize = info.exists && 'size' in info ? info.size : 0;
  if (!fileSize || fileSize === 0) {
    // Instance ini memberi tunnel basi/mati - buang file kosong lalu
    // lempar error supaya pemanggil coba instance Cobalt berikutnya.
    try {
      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    } catch {
      // abaikan
    }
    throw new Error('EMPTY_FILE_FROM_INSTANCE');
  }

  return { filename };
}

/**
 * Khusus YouTube: coba resolve + download langsung via Piped (tanpa
 * lewat Cobalt). Dipakai sebagai percobaan PERTAMA sebelum fallback ke
 * daftar instance Cobalt - kadang lebih cepat berhasil karena beda
 * infrastruktur/IP dari Cobalt, tapi TIDAK ADA JAMINAN selalu jalan:
 * YouTube bisa menolak (LOGIN_REQUIRED / "confirm you're not a bot")
 * kapan saja tergantung status IP instance Piped saat itu - sifatnya
 * usaha terbaik, bukan solusi permanen. Kalau gagal, otomatis lanjut
 * ke daftar fallback Cobalt seperti biasa.
 */
async function tryDownloadYouTubeViaPiped(
  request: DownloadRequest,
  cacheUri: string,
  downloadHeaders: Record<string, string>
): Promise<{ filename: string }> {
  const resolved = await resolveViaPiped(
    request.sourceUrl,
    request.mode,
    request.videoQuality
  );
  if (!resolved) {
    throw new Error('PIPED_RESOLVE_FAILED');
  }
  console.log('[FLAVA Download] YouTube (Piped): resolve OK, mulai unduh...');

  // Sama seperti jalur Cobalt: pakai downloadAsync non-resumable karena
  // stream Piped/googlevideo.com kadang tidak mengirim Content-Length
  // pasti juga.
  const result = await FileSystem.downloadAsync(
    resolved.downloadUrl,
    cacheUri,
    { headers: downloadHeaders }
  );
  if (!result || result.status !== 200) {
    throw new Error(`Download gagal (HTTP ${result?.status ?? 'unknown'})`);
  }
  const info = await FileSystem.getInfoAsync(cacheUri);
  const fileSize = info.exists && 'size' in info ? info.size : 0;
  if (!fileSize || fileSize === 0) {
    try {
      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    } catch {
      // abaikan
    }
    throw new Error('EMPTY_FILE_FROM_INSTANCE');
  }

  return { filename: resolved.filename };
}

/**
 * Khusus YouTube: coba Piped dulu (percobaan pertama), lalu kalau
 * gagal coba beberapa instance Cobalt secara berurutan sampai salah
 * satu berhasil memberikan file dengan isi (>0 byte). Ini memperbaiki
 * bug "File yang diterima kosong (0 byte)" - tanpa memengaruhi jalur
 * download platform lain (TikTok/IG/dll).
 */
async function downloadYouTubeWithFallback(
  request: DownloadRequest,
  cacheUri: string,
  downloadHeaders: Record<string, string>,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ filename: string }> {
  let lastError: Error = new Error('Gagal mengunduh dari YouTube');

  // Percobaan pertama: Piped langsung (bukan lewat Cobalt). Kalau
  // gagal (resolve gagal, LOGIN_REQUIRED, atau hasil 0 byte), lanjut
  // ke daftar fallback Cobalt di bawah - tidak ada perubahan pada
  // urutan/logika Cobalt yang sudah ada.
  try {
    onProgress?.({ percent: null, downloadedMb: 0 });
    const { filename } = await tryDownloadYouTubeViaPiped(
      request,
      cacheUri,
      downloadHeaders
    );
    const info = await FileSystem.getInfoAsync(cacheUri);
    const fileSize = info.exists && 'size' in info ? info.size : 0;
    const downloadedMb = Math.round((fileSize / (1024 * 1024)) * 10) / 10;
    onProgress?.({ percent: 95, downloadedMb });
    console.log('[FLAVA Download] YouTube: sukses via Piped');
    return { filename };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      '[FLAVA Download] YouTube: Piped gagal ->',
      message,
      '- lanjut coba instance Cobalt...'
    );
  }

  for (let i = 0; i < YOUTUBE_COBALT_FALLBACK_URLS.length; i++) {
    const baseUrl = YOUTUBE_COBALT_FALLBACK_URLS[i];
    try {
      onProgress?.({ percent: null, downloadedMb: 0 });
      const { filename } = await tryDownloadYouTubeFromInstance(
        baseUrl,
        request,
        cacheUri,
        downloadHeaders
      );
      const info = await FileSystem.getInfoAsync(cacheUri);
      const fileSize = info.exists && 'size' in info ? info.size : 0;
      const downloadedMb = Math.round((fileSize / (1024 * 1024)) * 10) / 10;
      onProgress?.({ percent: 95, downloadedMb });
      console.log('[FLAVA Download] YouTube: sukses via', baseUrl);
      return { filename };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(
        '[FLAVA Download] YouTube: instance gagal (',
        baseUrl,
        ') ->',
        lastError.message,
        i < YOUTUBE_COBALT_FALLBACK_URLS.length - 1
          ? '- coba instance berikutnya...'
          : '- tidak ada instance lain.'
      );
    }
  }

  if (lastError.message === 'EMPTY_FILE_FROM_INSTANCE') {
    throw new Error(
      'File yang diterima kosong (0 byte) dari semua server download. Coba lagi nanti.'
    );
  }
  throw lastError;
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
  console.log(
    '[FLAVA Download] Mulai. Mode:',
    request.mode,
    'URL:',
    request.sourceUrl
  );

  const isAudio = request.mode === 'audio';
  const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const downloadHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  let safeName: string;
  let cacheUri: string;

  if (isYouTubeUrl(request.sourceUrl)) {
    // ===== Jalur khusus YouTube (Piped dulu, lalu fallback Cobalt) =====
    const tempName = `youtube_${Date.now()}.tmp`;
    cacheUri = `${FileSystem.cacheDirectory}${tempName}`;

    const watchdog = setTimeout(() => {
      console.log('[FLAVA Download] Watchdog: timeout 3 menit (YouTube)');
    }, 180_000);

    let filename: string;
    try {
      const result = await downloadYouTubeWithFallback(
        request,
        cacheUri,
        downloadHeaders,
        onProgress
      );
      filename = result.filename;
    } finally {
      clearTimeout(watchdog);
    }

    safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
    // File sudah terunduh dengan nama sementara di cacheUri; cukup
    // pastikan safeName konsisten untuk tahap simpan ke vault di bawah.
  } else {
    // ===== Jalur normal (TikTok, IG, Facebook, dll - TIDAK DIUBAH) =====
    const { downloadUrl, filename } = await resolveMediaUrl(request);
    console.log('[FLAVA Download] Resolve OK:', filename);
    safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
    cacheUri = `${FileSystem.cacheDirectory}${safeName}`;

    let stalled = false;
    const watchdog = setTimeout(() => {
      stalled = true;
      console.log('[FLAVA Download] Watchdog: timeout 3 menit');
    }, 180_000);

    const resumable = FileSystem.createDownloadResumable(
      downloadUrl,
      cacheUri,
      { headers: downloadHeaders },
      (progress) => {
        const total = progress.totalBytesExpectedToWrite;
        const downloadedMb =
          Math.round((progress.totalBytesWritten / (1024 * 1024)) * 10) / 10;
        const percent =
          total > 0
            ? Math.min(
                95,
                Math.round((progress.totalBytesWritten / total) * 100)
              )
            : null;
        onProgress?.({ percent, downloadedMb });
      }
    );

    const result = await Promise.race([
      resumable.downloadAsync(),
      new Promise<null>((_, reject) =>
        setTimeout(() => {
          if (stalled) {
            reject(
              new Error(
                'Koneksi ke server download terhenti. Coba lagi atau ganti jaringan.'
              )
            );
          }
        }, 180_000)
      ),
    ]).finally(() => clearTimeout(watchdog));

    if (!result || result.status !== 200) {
      try {
        await FileSystem.deleteAsync(cacheUri, { idempotent: true });
      } catch {
        // abaikan
      }
      throw new Error(
        `Download gagal (HTTP ${result?.status ?? 'unknown'})`
      );
    }
  }

  // 2. Pindahkan ke folder "FLa Vault" (SAF)
  onProgress?.({ percent: 96, downloadedMb: 0 });
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

  onProgress?.({ percent: 100, downloadedMb: 0 });
  await notifyDownloadComplete(safeName, isAudio);
  return savedUri;
}
