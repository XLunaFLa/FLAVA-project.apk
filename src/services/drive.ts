/**
 * Service Google Drive API - Backup & Restore FLa Vault Project.
 * Menggunakan scope https://www.googleapis.com/auth/drive.file
 * sehingga aplikasi HANYA bisa melihat file yang ia buat sendiri.
 */

import { BackupPayload } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILE_NAME = 'fla-vault-backup.json';

export interface BackupFileInfo {
  id: string;
  name: string;
  modifiedTime: string;
}

/** Wrapper fetch dengan Authorization header + penanganan error umum */
async function driveFetch(
  accessToken: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Sesi Google kedaluwarsa. Silakan login ulang.');
  }
  if (!response.ok) {
    throw new Error(`Google Drive error (HTTP ${response.status})`);
  }
  return response;
}

/** Cari file backup terbaru di Google Drive milik user */
export async function findBackupFile(
  accessToken: string
): Promise<BackupFileInfo | null> {
  const query = encodeURIComponent(
    `name = '${BACKUP_FILE_NAME}' and trashed = false`
  );
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API}/files?q=${query}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,modifiedTime)`
  );

  const json = await response.json();
  const file = json.files?.[0];
  if (!file) return null;

  return {
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
  };
}

/**
 * Upload payload backup ke Google Drive (multipart upload).
 * Strategi single-file: hapus backup lama lalu upload versi terbaru.
 */
export async function uploadBackup(
  accessToken: string,
  payload: BackupPayload
): Promise<string> {
  // Hapus backup lama agar Drive tidak menumpuk file duplikat
  const existing = await findBackupFile(accessToken);
  if (existing) {
    await driveFetch(accessToken, `${DRIVE_API}/files/${existing.id}`, {
      method: 'DELETE',
    });
  }

  const boundary = `flavault_${Date.now()}`;
  const metadata = JSON.stringify({
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
  });
  const fileContent = JSON.stringify(payload);

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const response = await driveFetch(
    accessToken,
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  const json = await response.json();
  return json.id as string;
}

/** Download & parse file backup terbaru dari Google Drive */
export async function downloadBackup(accessToken: string): Promise<BackupPayload> {
  const file = await findBackupFile(accessToken);
  if (!file) {
    throw new Error('Tidak ada file backup ditemukan di Google Drive');
  }

  const response = await driveFetch(
    accessToken,
    `${DRIVE_API}/files/${file.id}?alt=media`
  );

  const payload = (await response.json()) as BackupPayload;

  if (!payload || !Array.isArray(payload.links)) {
    throw new Error('Format file backup tidak valid');
  }

  return payload;
}
