# ⚡ Snap & Sync — AI-Powered EMR Mobile Client ⚡

![Expo](https://img.shields.io/badge/Expo-1C1E24?style=for-the-badge&logo=expo&logoColor=fff)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)

A blazingly fast, **offline-first** mobile application designed to securely capture patient ordonnances (medical notes), queue them locally without internet, and magically extract handwritten data via Google Gemini AI the moment you reconnect! 🏥✨

## 🚀 Features

- 🔋 **True Offline-First Architecture**: Out in a rural clinic? No problem. The app uses `expo-sqlite` and `expo-file-system` to securely vault high-res document photos locally. Keep snapping without dropping a frame.
- 🔄 **Smart Background Sync**: Our background worker (`NetInfo` powered) silently monitors your connection. Bring the phone online, and it dynamically pushes your pending queue to Supabase.
- 🧠 **Instant Gemini 2.5 AI Extraction**: Whether you're capturing online or syncing an offline queue, we beam the image to Gemini Vision to instantly transcribe Symptoms, Diagnoses, and Medications.
- 📊 **Confidence Analytics & Smart Statuses**: AI isn't perfect, so we track it:
  - **Autocaptured**: Human reviewed, 0 edits. Perfection! 🎯
  - **Assisted Capture**: Human caught a mistake and edited it. ✍️
  - **AI Verified**: Captured offline, synced in the background with >80% confidence! 🤖
  - **Queue-Reviewed**: Captured offline, but the AI struggled (<80%). Sent to your Review Queue. ⚠️
- 🎨 **Premium Native Polish**: Flat, modern UI cards. Emerald Green confidence rings. `expo-haptics` for tactile validation. It feels like a native iOS/Android powerhouse.

---

## 🛠 Prerequisites

- Node.js (v18+)
- [Expo Go app](https://expo.dev/client) installed on your physical device (iOS or Android)
- Supabase Project & Google Gemini API Key

## 🏁 Getting Started

1. **Install Dependencies**
   *(Note: `--legacy-peer-deps` is required to resolve React Native versioning conflicts with Expo SDK 54)*
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=<your-anon-key>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   EXPO_PUBLIC_GEMINI_API_KEY=<your-gemini-api-key>
   ```

3. **Ignite the Engines! 🔥**
   Always clear the cache when starting to avoid stale Babel configs.
   ```bash
   npx expo start --clear
   ```

4. **Run on Device**
   Open the **Expo Go** app on your physical device and scan the QR code displayed in your terminal!
   *(Note: The Camera requires a physical device to test).*

---

## 🌊 Data Flow Lifecycle

1. **Session Start**: Doctor initiates a session. ID is cached locally.
2. **Capture**: Photo is snapped natively and saved permanently to the device's `documentDirectory`.
3. **Queue / AI**: 
   - *Online?* Instantly asks Gemini for the extraction. Doctor reviews and approves on the spot.
   - *Offline?* Queues the snapshot into local SQLite.
4. **Resync**: Background worker detects Wi-Fi. It iterates the queue, runs the AI extraction in the background, uploads the photo to Supabase Storage, and commits the JSON to Postgres.
5. **History**: Everything resolves into a beautiful, searchable timeline!

---
*Built for speed, reliability, and modern medical data entry.* 🩺📱
