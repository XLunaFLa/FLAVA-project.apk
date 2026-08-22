# 🛡️ FLa Vault Project

Aplikasi mobile **manajemen Bookmark & Link Vault pribadi** yang dibangun dengan **React Native (Expo) + TypeScript**.

![Tech](https://img.shields.io/badge/Expo-SDK%2052-black) ![Tech](https://img.shields.io/badge/TypeScript-5.x-blue) ![Tech](https://img.shields.io/badge/Theme-AMOLED%20Black-yellow)

## ✨ Fitur

| Fitur | Deskripsi |
|---|---|
| 🔐 **Google Sign-In** | Login via `expo-auth-session` (browser OAuth, kompatibel Expo Go) |
| 💾 **Offline-First** | Data tersimpan lokal di SQLite (`expo-sqlite`) — cepat & bisa dibuka tanpa internet |
| ☁️ **Backup & Restore** | Cadangkan seluruh link & kategori ke Google Drive (scope `drive.file`), pulihkan di HP baru |
| 🖼️ **Auto Metadata** | Judul & thumbnail ditarik otomatis via **Microlink.io** free API |
| ✍️ **Fallback Manual** | Kolom judul/catatan manual + toast notification jika API gagal |
| 🔍 **Pencarian** | Search bar untuk judul, URL, dan catatan |
| ⭐ **Favorit** | Tandai link favorit dengan satu ketukan |
| 📋 **Salin URL** | Tombol copy di setiap card (`expo-clipboard`) |
| 🗂️ **Kategori Kustom** | Buat/edit/hapus kategori + filter pills horizontal |
| 🔗 **Deep Linking** | Link dibuka ke aplikasi aslinya (FB/IG/dll) atau browser bawaan |
| 📤 **Share Extension** | Bagikan link dari aplikasi lain langsung ke FLa Vault (Android) |
| 🌑 **Tema AMOLED** | Hitam pekat + card bersih + FAB kuning — hemat baterai |

## 📁 Struktur Project

```
fla-vault-project/
├── app/
│   ├── _layout.tsx          # Root layout + provider + share intent handler
│   ├── add-link.tsx         # Modal form Tambah Link (auto metadata + fallback)
│   └── (tabs)/
│       ├── _layout.tsx      # Bottom nav: Home, Favorites, Categories, Settings
│       ├── index.tsx        # Home: search, filter pills, daftar link, FAB
│       ├── favorites.tsx    # Daftar link favorit
│       ├── categories.tsx   # CRUD kategori kustom
│       └── settings.tsx     # Akun Google, Backup/Restore Drive, statistik
├── src/
│   ├── components/          # Toast, LinkCard, CategoryPills, SearchBar, FAB, EmptyState
│   ├── db/database.ts       # SQLite: migrasi + semua query (parameterized)
│   ├── services/
│   │   ├── auth.tsx         # Google Sign-In + sesi SecureStore
│   │   ├── drive.ts         # Google Drive API (upload/download backup)
│   │   └── metadata.ts      # Microlink.io metadata extractor
│   ├── types/index.ts       # Tipe data global
│   └── utils/validation.ts  # Validasi URL & ekstraksi link dari teks share
├── constants/theme.ts       # Tema premium vault (black + yellow)
├── app.json                 # Konfigurasi Expo + intent filter share (Android)
└── .env.example             # Template OAuth Client IDs
```

## 🚀 Cara Menjalankan

### 1. Install Dependencies

```bash
cd fla-vault-project
npm install
```

### 2. Setup Google Cloud (WAJIB untuk Login & Backup)

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project baru.
2. Aktifkan **Google Drive API** di menu *APIs & Services → Library*.
3. Konfigurasi *OAuth consent screen* (External, tambahkan email kamu sebagai test user).
4. Buat **OAuth 2.0 Client IDs** di *APIs & Services → Credentials*:
   - **Web application** → WAJIB (dipakai untuk login via Expo Go & Google Drive API). Tambahkan *Authorized redirect URI* sesuai output `redirectUri` dari `useAuthRequest`.
   - **Android** → package name: `com.flavault.project` (untuk production build Android).
   - **iOS** → bundle identifier kamu (untuk production build iOS).
5. Copy file `.env.example` menjadi `.env`, lalu isi minimal Web Client ID:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
```

> 💡 **Catatan:** Scope yang dipakai adalah `drive.file` — aplikasi hanya bisa melihat file yang **dibuatnya sendiri** (`fla-vault-backup.json`), tidak bisa mengakses seluruh Drive kamu.

### 3. Jalankan Aplikasi

```bash
npm start
```

- Scan QR code dengan aplikasi **Expo Go** di HP kamu (Android/iOS).
- Atau tekan `a` untuk Android Emulator / `i` untuk iOS Simulator.

### 4. Build Production (Opsional)

```bash
npx eas build -p android --profile preview
```

## 📤 Share Extension (Bagikan Link dari Aplikasi Lain)

- **Android** ✅ — Sudah aktif otomatis lewat `intentFilters` di [`app.json`](app.json) (`ACTION_SEND` untuk `text/plain`). Buka aplikasi mana pun → tekan **Share** → pilih **FLa Vault Project** → form Tambah Link terbuka dengan URL sudah terisi.
- **iOS** ⚠️ — Share Extension iOS membutuhkan **native module + development build** (tidak bisa di Expo Go). Gunakan `npx expo prebuild` + Xcode dengan Share Extension target, atau library seperti `react-native-share-menu`.

## 🔒 Keamanan

- ✅ Semua query SQLite menggunakan **parameterized statements** (anti SQL injection)
- ✅ Access token Google disimpan di **SecureStore** (encrypted keystore)
- ✅ OAuth scope minimal (`drive.file`) — bukan akses penuh Drive
- ✅ Tidak ada credentials yang di-hardcode (semua via `.env`)
- ✅ Timeout & error handling pada semua network request

## 📝 Catatan Teknis

- **Token Google berlaku ±1 jam.** Jika sesi kedaluwarsa, aplikasi akan meminta login ulang saat Backup/Restore (toast "Sesi Google kedaluwarsa").
- **Restore bersifat merge (upsert)** — data backup menimpa data lokal berdasarkan URL link, tanpa menghapus data lain di perangkat.
- **Microlink.io free tier** dibatasi ±50 request/hari per IP. Jika limit tercapai, gunakan input judul manual.
- Database SQLite tersimpan di `fla-vault.db` — data tetap aman walau aplikasi ditutup.
