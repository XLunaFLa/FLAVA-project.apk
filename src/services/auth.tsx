/**
 * Service autentikasi Google Sign-In - FLa Vault Project.
 * Menggunakan expo-auth-session (browser-based OAuth, kompatibel Expo Go).
 * Access token disimpan aman di SecureStore & dipakai untuk Google Drive API.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import { GoogleUser } from '../types';

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

const STORAGE_KEY = 'flavault.auth.session';
const AUTH_CONTEXT = createContext<AuthContextValue | undefined>(undefined);

interface StoredSession {
  user: GoogleUser;
  accessToken: string;
  expiresAt: number;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: false,
    ready: false,
  });

  // Scope drive.file: akses HANYA ke file yang dibuat oleh aplikasi ini
  const [request, response, promptAsync] = Google.useAuthRequest({
    // webClientId dipakai untuk Expo Go & web; android/ios untuk production build
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file',
    ],
    responseType: 'token',
    selectAccount: true,
  });

  // DEBUG: tampilkan redirect URI yang harus didaftarkan di Google Cloud Console
  // (APIs & Services -> Credentials -> Web Client -> Authorized redirect URIs)
  if (__DEV__ && request?.redirectUri) {
    console.log(
      '[FLa Vault] Daftarkan redirect URI ini di Google Cloud:',
      request.redirectUri
    );
  }

  // Pulihkan sesi tersimpan saat aplikasi dibuka
  useEffect(() => {
    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as StoredSession;
          // Token masih berlaku (beri margin 60 detik)
          if (saved.accessToken && Date.now() < saved.expiresAt - 60_000) {
            setState({
              user: saved.user,
              accessToken: saved.accessToken,
              loading: false,
              ready: true,
            });
            return;
          }
        }
      } catch {
        // Data rusak/tidak bisa dibaca -> anggap belum login
      }
      setState((prev) => ({ ...prev, ready: true }));
    })();
  }, []);

  const completeSignIn = useCallback(
    async (token: string, expiresIn?: number) => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const profileResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!profileResponse.ok) {
          throw new Error('Gagal mengambil profil Google');
        }
        const profile = await profileResponse.json();

        const user: GoogleUser = {
          sub: profile.sub,
          name: profile.name ?? '',
          email: profile.email ?? '',
          picture: profile.picture ?? null,
        };

        const expiresAt = Date.now() + (expiresIn ?? 3600) * 1000;
        const session: StoredSession = { user, accessToken: token, expiresAt };
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));

        setState({ user, accessToken: token, loading: false, ready: true });
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false }));
        throw error;
      }
    },
    []
  );

  // Tangani hasil redirect OAuth
  useEffect(() => {
    if (response?.type === 'success') {
      const { accessToken, expiresIn } = response.authentication ?? {};
      if (accessToken) {
        void completeSignIn(accessToken, expiresIn).catch(() => {
          /* error sudah ditandai lewat state loading; UI menampilkan toast */
        });
      }
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [response, completeSignIn]);

  const signIn = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await promptAsync();
      // Hasilnya ditangani useEffect [response] di atas
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    const { accessToken } = state;
    // Cabut token di sisi Google (best effort, abaikan jika gagal)
    if (accessToken) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${accessToken}`,
        });
      } catch {
        // Revoke gagal tetap lanjut logout lokal
      }
    }
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setState({ user: null, accessToken: null, loading: false, ready: true });
  }, [state.accessToken]);

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
