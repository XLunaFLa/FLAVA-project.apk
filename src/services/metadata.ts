/**
 * Service ekstraksi metadata link via Microlink.io (free API).
 * Menarik Judul dan Gambar Thumbnail secara otomatis dari sebuah URL.
 */

import { LinkMetadata } from '../types';

const MICROLINK_ENDPOINT = 'https://api.microlink.io';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Tarik metadata (judul + thumbnail) dari URL.
 * Melempar Error jika jaringan gagal / respons tidak valid,
 * caller wajib menyediakan fallback input manual.
 */
export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  const endpoint = `${MICROLINK_ENDPOINT}/?url=${encodeURIComponent(url)}&meta=true`;

  // Timeout manual agar UI tidak menggantung saat jaringan buruk
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Microlink error (HTTP ${response.status})`);
    }

    const json = await response.json();

    if (json.status !== 'success' || !json.data) {
      throw new Error('Microlink tidak dapat membaca halaman tersebut');
    }

    // Prioritas thumbnail: image og:image > logo situs
    const thumbnail: string | null =
      json.data.image?.url ?? json.data.logo?.url ?? null;

    return {
      title: typeof json.data.title === 'string' ? json.data.title : null,
      thumbnail,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Waktu tunggu habis. Periksa koneksi internet kamu.');
    }
    throw error instanceof Error
      ? error
      : new Error('Gagal menarik metadata dari link');
  } finally {
    clearTimeout(timeoutId);
  }
}
