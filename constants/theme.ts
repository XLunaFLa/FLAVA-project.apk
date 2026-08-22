/**
 * Tema "Premium Vault" - FLa Vault Project
 * Latar hitam pekat (hemat baterai AMOLED) + aksen kuning kontras.
 */

export const COLORS = {
  /** Latar utama hitam pekat / pure black */
  background: '#000000',
  /** Permukaan sekunder (header, tab bar, modal) */
  surface: '#0D0D0D',
  /** Warna card */
  card: '#161616',
  /** Card saat ditekan */
  cardPressed: '#1F1F1F',
  /** Garis pemisah / border */
  border: '#262626',
  textPrimary: '#FFFFFF',
  textSecondary: '#9E9E9E',
  textDisabled: '#5C5C5C',
  /** Aksen kuning khas vault (FAB, highlight, ikon aktif) */
  accent: '#FFD600',
  /** Teks di atas permukaan kuning */
  accentText: '#000000',
  danger: '#FF5252',
  success: '#4CAF50',
  info: '#4FC3F7',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  title: 22,
} as const;

export const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  round: 999,
} as const;

/** Nama resmi aplikasi - dipakai di header/app bar */
export const APP_NAME = 'FLa Vault Project';
