/**
 * Layer database SQLite - FLa Vault Project.
 * Semua query menggunakan parameterized statements (anti SQL injection).
 * Data tersimpan lokal agar aplikasi cepat & bisa dibuka offline.
 */

import * as SQLite from 'expo-sqlite';
import { BackupPayload, Category, LinkItem, RestoreResult, VaultStats } from '../types';

/**
 * Singleton berbasis promise: mencegah race condition saat beberapa
 * layar memanggil getDb() bersamaan (penyebab NullPointerException).
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Buka (atau buat) koneksi database + jalankan migrasi */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const dbInstance = await SQLite.openDatabaseAsync('fla-vault.db');

  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#FFD600',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      thumbnail TEXT,
      notes TEXT,
      category_id INTEGER,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);
    CREATE INDEX IF NOT EXISTS idx_links_favorite ON links(is_favorite);
  `);

  return dbInstance;
}

// ============================================================
// APP SETTINGS (key-value sederhana)
// ============================================================

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/** Ambil jumlah kolom tata letak tersimpan (default 1) */
export async function getLayoutColumns(): Promise<number> {
  const saved = await getSetting('layout_columns');
  const parsed = saved ? parseInt(saved, 10) : 1;
  return parsed >= 1 && parsed <= 4 ? parsed : 1;
}

/** Simpan jumlah kolom tata letak (1-4) */
export async function setLayoutColumns(columns: number): Promise<void> {
  await setSetting('layout_columns', String(columns));
}

/** Seed kategori default saat pertama kali aplikasi dijalankan */
export async function ensureSeedData(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM categories'
  );
  if ((row?.total ?? 0) === 0) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)',
      ['Umum', '#FFD600']
    );
  }
}

// ============================================================
// LINKS
// ============================================================

export interface GetLinksOptions {
  search?: string;
  categoryId?: number | null;
  favoritesOnly?: boolean;
}

export async function getLinks(options: GetLinksOptions = {}): Promise<LinkItem[]> {
  const db = await getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.search && options.search.trim()) {
    conditions.push('(l.title LIKE ? OR l.url LIKE ? OR l.notes LIKE ?)');
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term);
  }

  // categoryId === null artinya filter "Semua" (tanpa kondisi kategori)
  if (options.categoryId != null) {
    conditions.push('l.category_id = ?');
    params.push(options.categoryId);
  }

  if (options.favoritesOnly) {
    conditions.push('l.is_favorite = 1');
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.getAllAsync<LinkItem>(
    `SELECT l.* FROM links l ${whereClause} ORDER BY l.created_at DESC, l.id DESC`,
    params
  );
}

export interface InsertLinkInput {
  url: string;
  title: string;
  thumbnail?: string | null;
  notes?: string | null;
  categoryId?: number | null;
}

export async function insertLink(input: InsertLinkInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO links (url, title, thumbnail, notes, category_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.url.trim(),
      input.title.trim(),
      input.thumbnail ?? null,
      input.notes ?? null,
      input.categoryId ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function deleteLink(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM links WHERE id = ?', [id]);
}

export async function setLinkFavorite(
  id: number,
  isFavorite: boolean
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE links SET is_favorite = ? WHERE id = ?', [
    isFavorite ? 1 : 0,
    id,
  ]);
}

// ============================================================
// CATEGORIES
// ============================================================

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC'
  );
}

export async function createCategory(name: string, color: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO categories (name, color) VALUES (?, ?)',
    [name.trim(), color]
  );
}

export async function updateCategory(
  id: number,
  name: string,
  color: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET name = ?, color = ? WHERE id = ?', [
    name.trim(),
    color,
    id,
  ]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  // Link yang memakai kategori ini tidak ikut terhapus (category_id jadi NULL)
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

// ============================================================
// STATISTIK
// ============================================================

export async function getStats(): Promise<VaultStats> {
  const db = await getDb();
  const [links, favorites, categories] = await Promise.all([
    db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM links'),
    db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM links WHERE is_favorite = 1'
    ),
    db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM categories'
    ),
  ]);
  return {
    totalLinks: links?.total ?? 0,
    totalFavorites: favorites?.total ?? 0,
    totalCategories: categories?.total ?? 0,
  };
}

// ============================================================
// BACKUP / RESTORE
// ============================================================

/** Ambil seluruh data untuk dipbackup ke Google Drive */
export async function exportAllData(): Promise<BackupPayload> {
  const [categories, links] = await Promise.all([getAllCategories(), getLinks()]);
  return {
    version: 1,
    appName: 'FLAVA',
    exportedAt: new Date().toISOString(),
    categories,
    links,
  };
}

/**
 * Restore data dari Google Drive.
 * Strategi merge (upsert): data dari backup menimpa data lokal
 * berdasarkan id kategori / url link, tanpa menghapus data lain.
 */
export async function restoreFromBackup(
  payload: BackupPayload
): Promise<RestoreResult> {
  const db = await getDb();
  let categoriesRestored = 0;
  let linksRestored = 0;

  // Tanpa withTransactionAsync (rawan NPE di beberapa perangkat).
  // Statement dijalankan berurutan - tetap aman karena upsert idempoten.
  for (const category of payload.categories ?? []) {
    await db.runAsync(
      `INSERT INTO categories (id, name, color, created_at)
       VALUES (?, ?, ?, COALESCE(?, datetime('now')))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         color = excluded.color`,
      [category.id, category.name, category.color, category.created_at ?? null]
    );
    categoriesRestored++;
  }

  for (const link of payload.links ?? []) {
    await db.runAsync(
      `INSERT INTO links (id, url, title, thumbnail, notes, category_id, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
       ON CONFLICT(url) DO UPDATE SET
         title = excluded.title,
         thumbnail = excluded.thumbnail,
         notes = excluded.notes,
         category_id = excluded.category_id,
         is_favorite = excluded.is_favorite`,
      [
        link.id,
        link.url,
        link.title,
        link.thumbnail ?? null,
        link.notes ?? null,
        link.category_id ?? null,
        link.is_favorite ?? 0,
        link.created_at ?? null,
      ]
    );
    linksRestored++;
  }

  return { categoriesRestored, linksRestored };
}
