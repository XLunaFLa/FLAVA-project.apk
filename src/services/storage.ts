/**
 * Service penyimpanan - FLa Vault Project.
 * Menggunakan Storage Access Framework (SAF) - kompatibel semua HP tanpa
 * izin "All files access":
 *   1. Saat pertama kali, user diminta memilih folder SEKALI SAJA.
 *      Di dialog picker, user bisa langsung membuat folder baru bernama
 *      "FLa Vault" di internal storage (tombol folder+ / New folder).
 *   2. Izin SAF bersifat PERMANEN - tidak akan ditanya lagi.
 *   3. Semua hasil download disimpan ke folder yang dipilih itu.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { getSetting, setSetting } from '../db/database';

const { StorageAccessFramework } = FileSystem;

const VAULT_URI_KEY = 'saf_vault_uri';

/** Error khusus: izin folder belum diberikan */
export const ERR_STORAGE_PERMISSION = 'NEED_STORAGE_PERMISSION';

/**
 * Ambil URI folder vault yang sudah diizinkan.
 * Throw ERR_STORAGE_PERMISSION jika belum pernah diizinkan.
 */
export async function getVaultUri(): Promise<string> {
  const vaultUri = await getSetting(VAULT_URI_KEY);
  if (!vaultUri) {
    throw new Error(ERR_STORAGE_PERMISSION);
  }
  return vaultUri;
}

/**
 * Buka dialog pilih folder (SEKALI SAJA).
 * Instruksi untuk user: masuk ke internal storage, buat folder baru
 * bernama "FLa Vault", lalu tekan "Use this folder".
 * Return true jika berhasil.
 */
export async function requestVaultAccess(): Promise<boolean> {
  const perms = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perms.granted) return false;
  await setSetting(VAULT_URI_KEY, perms.directoryUri);
  return true;
}

/** Simpan file biner (base64) ke dalam folder vault */
export async function writeVaultFile(
  filename: string,
  mimeType: string,
  base64Content: string
): Promise<string> {
  const vaultUri = await getVaultUri();
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  const fileUri = await StorageAccessFramework.createFileAsync(
    vaultUri,
    safeName,
    mimeType
  );
  await FileSystem.writeAsStringAsync(fileUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}
