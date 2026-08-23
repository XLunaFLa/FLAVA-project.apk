/**
 * Service ekstraksi metadata link - FLa Vault Project.
 * Strategi multi-provider (gratis, tanpa API key):
 * 1. Microlink.io     -> situs web umum (og:image, judul)
 * 2. oEmbed resmi     -> YouTube & TikTok (thumbnail video asli)
 * 3. Favicon fallback -> jika semua gagal, pakai logo situs (selalu berhasil)
 */

import { LinkMetadata } from '../types';

const MICROLINK_ENDPOINT = 'https://api.microlink.io';
const REQUEST_TIMEOUT_MS = 15_000;

/** Fetch JSON dengan timeout agar UI tidak menggantung saat jaringan buruk */
async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ============================================================
// PROVIDER 1: Microlink.io (situs web umum)
// ============================================================
async function fromMicrolink(url: string): Promise<LinkMetadata> {
  const endpoint = `${MICROLINK_ENDPOINT}/?url=${encodeURIComponent(url)}&meta=true`;
  const json = await fetchJson(endpoint);

  if (json.status !== 'success' || !json.data) {
    throw new Error('Microlink gagal membaca halaman');
  }

  const thumbnail: string | null =
    json.data.image?.url ?? json.data.logo?.url ?? null;

  if (!json.data.title && !thumbnail) {
    throw new Error('Microlink tidak mengembalikan data');
  }

  return {
    title: typeof json.data.title === 'string' ? json.data.title : null,
    thumbnail,
  };
}

// ============================================================
// PROVIDER 2: oEmbed resmi (YouTube, TikTok)
// ============================================================
function getOEmbedEndpoint(url: string): string | null {
  const lower = url.toLowerCase();
  const encoded = encodeURIComponent(url);

  // YouTube (video, shorts, youtu.be)
  if (
    lower.includes('youtube.com/watch') ||
    lower.includes('youtube.com/shorts') ||
    lower.includes('youtu.be/')
  ) {
    return `https://www.youtube.com/oembed?url=${encoded}&format=json`;
  }
  // TikTok (video & vt.short link)
  if (lower.includes('tiktok.com/')) {
    return `https://www.tiktok.com/oembed?url=${encoded}`;
  }
  return null;
}

async function fromOEmbed(url: string): Promise<LinkMetadata> {
  const endpoint = getOEmbedEndpoint(url);
  if (!endpoint) throw new Error('Tidak ada provider oEmbed untuk URL ini');

  const json = await fetchJson(endpoint);
  const thumbnail: string | null = json.thumbnail_url ?? null;

  if (!json.title && !thumbnail) {
    throw new Error('oEmbed tidak mengembalikan data');
  }

  return {
    title: typeof json.title === 'string' ? json.title : null,
    thumbnail,
  };
}

// ============================================================
// PROVIDER 3: Favicon fallback (logo situs - hampir selalu berhasil)
// ============================================================
async function faviconFallback(url: string): Promise<LinkMetadata> {
  const host = hostOf(url);
  return {
    title: host,
    thumbnail: `https://www.google.com/s2/favicons?domain=${host}&sz=256`,
  };
}

/**
 * Tarik metadata (judul + thumbnail) dari URL dengan strategi berlapis.
 * Melempar Error hanya jika benar-benar offline (semua provider gagal).
 */
export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  const providers: Array<(u: string) => Promise<LinkMetadata>> = [
    fromMicrolink,
    fromOEmbed,
    faviconFallback,
  ];

  let lastError: Error = new Error('Gagal menarik metadata');

  for (const provider of providers) {
    try {
      const metadata = await provider(url);
      if (metadata.title || metadata.thumbnail) {
        return metadata;
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Gagal menarik metadata');
    }
  }

  throw lastError;
}
