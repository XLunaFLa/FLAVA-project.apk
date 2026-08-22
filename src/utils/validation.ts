/**
 * Util validasi input.
 */

/** Validasi URL http/https yang benar-benar bisa dibuka */
export function isValidUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Ambil URL pertama dari sebuah teks (dipakai untuk share intent) */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}
