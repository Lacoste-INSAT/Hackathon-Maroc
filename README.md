# Snap & Sync — Mobile Client (Expo / React Native)

A resilient, offline-first mobile application designed to securely capture patient ordonnances, queue them locally when offline, and synchronize with a cloud database (Supabase) and AI extraction service (Gemini) when network conditions allow.

## Features

- **Offline-First Architecture**: Uses local `expo-sqlite` and `expo-file-system` to queue and store high-resolution document photos immediately, without requiring an active internet connection.
- **Background Synchronization**: Monitors network conditions utilizing `@react-native-community/netinfo` and automatically pushes pending captures to Supabase when the device comes online.
- **AI Extraction Review**: Features a Review Queue UI where doctors or administrators can review Google Gemini OCR extractions, view confidence scores, and make manual corrections before final approval.
- **History Tracking**: Comprehensive, searchable history view to audit past sessions, AI extractions, and synced data.
- **Native Polish**: Implements `expo-haptics` for tactile feedback, Skeleton loaders for smooth UX, multi-state dynamic UI styling, and robust error handling.

## Prerequisites

- Node.js (v18+)
- [Expo Go app](https://expo.dev/client) installed on your physical device (iOS or Android)
- Supabase Project with required schema definitions

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```
   *(Note: `--legacy-peer-deps` is required to resolve version conflicts with `@react-native-community/netinfo` and Expo SDK 52+)*

2. **Environment Configuration**
   Create a `.env` file in the `mobile` directory with your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=<your-anon-key>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   EXPO_PUBLIC_GEMINI_API_KEY=<your-gemini-api-key>
   ```

3. **Start the Metro Bundler**
   You generally want to clear the cache when starting to avoid stale Babel configurations.
   ```bash
   npx expo start --clear
   ```

4. **Run on Device**
   Open the **Expo Go** app on your physical device and scan the QR code displayed in your terminal.
   *(Note: The Camera functionality cannot be tested in a web browser or typically simulator; a physical device is required).*

## Core Technologies

- **Framework**: Expo (SDK 54), React Native, Expo Router
- **State Management**: Zustand
- **Database (Local)**: expo-sqlite
- **Database (Cloud)**: @supabase/supabase-js (AsyncStorage adapter)
- **Camera & File System**: expo-camera, expo-file-system
- **Styling**: Custom Theme System (Vanilla RN Web/Native StyleSheet)

## Data Flow & State Machine

1. **Session Start**: Doctor initiates a session. ID is cached locally.
2. **Capture**: Photo is taken natively via `DocumentCamera.tsx` and saved permanently to `documentDirectory`.
3. **Queue**: Record is inserted into SQLite with status `pending_sync`.
4. **Sync Worker**: When `NetInfo` confirms internet access, background worker loops through the sync queue.
5. **Upload**: Photo is uploaded to Supabase Storage; row is inserted into Supabase DB.
6. **AI Hook**: Supabase triggers Edge Function (Deno) calling Google Gemini.
7. **Review**: Item appears in the Review Queue. Doctor corrects variables and Approves.

## Directory Structure
- `/app` - Expo Router file-based routing and Tab layouts
- `/components` - Pure presentational UI elements (`Card`, `Badge`, `Button`, `DocumentCamera`)
- `/contexts` - React context providers (Network Provider)
- `/hooks` - Custom hooks
- `/lib` - Core utilities, Supabase client initialization, Types, and Theming
- `/services` - Heavy local business logic (SQLite Repositories, Background Sync engine, Auth)
- `/stores` - Zustand global stores

---
Tap "Start Session" → Get prompted to scan a Patient QR code.
Enter the Active Session screen.
Continually snap photos.
If online, the AI immediately analyzes the photo and pops up the split-screen Review view for you to verify and approve.
You decide when to end the session by picking "End Session."
