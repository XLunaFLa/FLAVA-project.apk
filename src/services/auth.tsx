/**
 * Service autentikasi Google - FLa Vault Project.
 * v3: Menggunakan @react-native-google-signin/google-signin (SDK native).
 * - Popup pilih akun muncul NATIVE di dalam aplikasi (seperti aplikasi besar)
 * - Tidak ada lagi redirect browser / Error 400 invalid_request
 * - Access token untuk Google Drive didapat via pertukaran serverAuthCode
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { GoogleUser } from '../types';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const WEB_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET ?? '';

const STORAGE_KEY = 'flavault.auth.session';
const AUTH_CONTEXT = createContext<AuthContextValue | undefined>(undefined);

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Konfigurasi SDK native Google (sekali di level modul)
GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID || 'missing-web-client-id',
  offlineAccess: true, // agar dapat serverAuthCode -> ditukar jadi access token Drive
  scopes: ['openid', 'email', 'profile', DRIVE_SCOPE],
});

interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  /** true saat proses login sedang berjalan */
  loading: boolean;
  /** true setelah sesi tersimpan selesai dicek saat aplikasi dibuka */
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface StoredSession {
  user: GoogleUser;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Tukar serverAuthCode menjadi access token (untuk Google Drive API) */
async function exchangeCodeForTokens(
  serverAuthCode: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
  if (!WEB_CLIENT_SECRET) {
    throw new Error(
      'Client Secret Google belum diatur (EXPO_PUBLIC_GOOGLE_CLIENT_SECRET)'
    );
  }

  const body = new URLSearchParams({
    code: serverAuthCode,
    client_id: WEB_CLIENT_ID,
    client_secret: WEB_CLIENT_SECRET,
    redirect_uri: '',
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'Gagal menukar token Google'
    );
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? 3600,
  };
}

/** Perbarui access token menggunakan refresh token */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!WEB_CLIENT_SECRET) {
    throw new Error(
      'Client Secret Google belum diatur (EXPO_PUBLIC_GOOGLE_CLIENT_SECRET)'
    );
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: WEB_CLIENT_ID,
    client_secret: WEB_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'Sesi Google kedaluwarsa. Login ulang.'
    );
  }

  return { accessToken: json.access_token, expiresIn: json.expires_in ?? 3600 };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: false,
    ready: false,
  });

  // Pulihkan sesi tersimpan saat aplikasi dibuka; refresh token jika kedaluwarsa
  useEffect(() => {
    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as StoredSession;
          if (saved.accessToken && Date.now() < saved.expiresAt - 60_000) {
            setState({
              user: saved.user,
              accessToken: saved.accessToken,
              loading: false,
              ready: true,
            });
            return;
          }
          // Token kedaluwarsa -> coba refresh diam-diam
          if (saved.refreshToken) {
            try {
              const refreshed = await refreshAccessToken(saved.refreshToken);
              const updated: StoredSession = {
                ...saved,
                accessToken: refreshed.accessToken,
                expiresAt: Date.now() + refreshed.expiresIn * 1000,
              };
              await SecureStore.setItemAsync(
                STORAGE_KEY,
                JSON.stringify(updated)
              );
              setState({
                user: saved.user,
                accessToken: refreshed.accessToken,
                loading: false,
                ready: true,
              });
              return;
            } catch {
              // Refresh gagal -> hapus sesi, minta login ulang
              await SecureStore.deleteItemAsync(STORAGE_KEY);
            }
          }
        }
      } catch {
        // Data rusak/tidak bisa dibaca -> anggap belum login
      }
      setState((prev) => ({ ...prev, ready: true }));
    })();
  }, []);

  const signIn = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      // 1. Pastikan Google Play Services tersedia & tampilkan popup pilih akun
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // 2. Popup NATIVE pilih akun Google muncul di sini
      const result = await GoogleSignin.signIn();

      if (result.type === 'cancelled') {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      const data = result.data;
      const user: GoogleUser = {
        sub: data.user.id,
        name: data.user.name ?? '',
        email: data.user.email ?? '',
        picture: data.user.photo ?? null,
      };

      // 3. Tukar serverAuthCode -> access token (untuk Google Drive API)
      if (!data.serverAuthCode) {
        throw new Error('Server tidak mengembalikan kode otorisasi');
      }
      const tokens = await exchangeCodeForTokens(data.serverAuthCode);

      const session: StoredSession = {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
      };
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));

      setState({
        user,
        accessToken: tokens.accessToken,
        loading: false,
        ready: true,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Abaikan jika gagal - tetap bersihkan sesi lokal
    }
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setState({ user: null, accessToken: null, loading: false, ready: true });
  }, []);

  return (
    <AUTH_CONTEXT.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AUTH_CONTEXT.Provider>
  );
}

/** Hook untuk mengakses state & aksi autentikasi */
export function useAuth(): AuthContextValue {
  const context = useContext(AUTH_CONTEXT);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  }
  return context;
}
