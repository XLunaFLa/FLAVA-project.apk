/**
 * Tipe data global FLa Vault Project.
 */

/** Profil user yang login via Google Sign-In */
export interface GoogleUser {
  sub: string;
  name: string;
  email: string;
  picture: string | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface LinkItem {
  id: number;
  url: string;
  title: string;
  thumbnail: string | null;
  notes: string | null;
  category_id: number | null;
  is_favorite: 0 | 1;
  created_at: string;
}

/** Struktur payload yang disimpan ke Google Drive saat backup */
export interface BackupPayload {
  version: number;
  appName: string;
  exportedAt: string;
  categories: Category[];
  links: LinkItem[];
}

/** Hasil ekstraksi metadata dari Microlink.io */
export interface LinkMetadata {
  title: string | null;
  thumbnail: string | null;
}

export interface VaultStats {
  totalLinks: number;
  totalFavorites: number;
  totalCategories: number;
}

export interface RestoreResult {
  linksRestored: number;
  categoriesRestored: number;
}
