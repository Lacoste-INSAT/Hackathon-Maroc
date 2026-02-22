# Snap & Sync — Physical Device QA Checklist

This document provides a step-by-step guide to testing the "Offline First" architecture of Snap & Sync on a physical Android device using Expo Go.

## 🛠️ Pre-flight Setup

1. **Start the local server**
   - Ensure you are on the same Wi-Fi network as your development machine.
   - Run `npx expo start --lan` (or just `npm run start`) in your terminal.
2. **Open Expo Go**
   - Scan the QR code with your Android phone's camera (or from inside the Expo Go app).
   - Wait for the JavaScript bundle to finish loading.
3. **Verify App Launch**
   - Confirm you see the Splash Screen briefly as the local SQLite database initializes.
   - You should land on the Home Tab. No crash should occur.

---

## ✈️ Test 1: The "Offline First" Flow (Happy Path)

1. **Go Offline**
   - Pull down the Android quick settings and turn **ON** Airplane Mode (ensure both Wi-Fi and Cellular are off).
   - In the app, you should see the network status indicator change to offline (if implemented in UI), but the app should remain fully responsive.
2. **Create a Patient Session**
   - Tap "Start New Session".
   - Using another device or printout, scan a Patient QR Code (e.g., "AHM-924").
   - The app should quickly look up the patient locally (if previously cached) or accept the code offline.
3. **Capture a Document**
   - Take a photo of a medical record or prescription.
   - Approve the photo.
   - **Verification:** The photo should be saved instantly. The UI should show "Pending Sync" without giving any loading spinners or network errors.
4. **Trigger the Background Sync Worker**
   - Turn **OFF** Airplane Mode and wait for Wi-Fi to reconnect.
   - **Verification:** The background sync worker (started in `_layout.tsx`) should automatically detect the network change. It waits 3 seconds (debounce), then starts uploading the image to Supabase Storage and syncing the record.
   - Go to the **Queue Tab**. You should see the item disappear or its status change from "Pending" to "AI Processing" or "Completed".

---

## 🌩️ Test 2: Network Edge Cases (Interrupted Connections)

1. **Start a Sync, Then Interrupt It**
   - Turn on Airplane mode. Take 3 photos in quick succession so they queue up.
   - Go to the **Queue Tab** to verify 3 items are pending.
   - Turn **OFF** Airplane mode.
   - The moment the sync starts, turn **ON** Airplane mode again immediately.
   - **Verification:** The background worker should catch the network error, mark the current item as failed (with retry count incremented), and stop syncing. The app should not crash.
2. **Recover from Interruption**
   - Turn **OFF** Airplane mode again.
   - **Verification:** The worker should resume automatically. It should retry the failed item and process the remaining ones sequentially.

---

## 🩺 Test 3: The Review Queue Validation

1. **Trigger a Low Confidence Result**
   - Take a photo of a completely blank piece of paper or something entirely unreadable (like a scribbled mess) while connected to Wi-Fi.
   - The image will upload, and the Supabase Edge Function (`extract-handwriting`) will run.
   - Because it can't extract structured data with >80% confidence, it will set the record to `needs_review`.
2. **Verify Queue UI**
   - Go to the **Queue Tab**.
   - **Verification:** You should see this record listed under "Needs Review".
   - Tap on the record to view details. You should see the extracted data (or lack thereof) and the low confidence scores.
   - Modify one of the fields manually (e.g., typing in the correct symptoms).
   - Tap **"Submit & Verify"** to approve it. The record should move to the "History" tab as completed.
