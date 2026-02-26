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

---

## 🌐 TabibNet — Portail Web Patient (Prise de Rendez-vous)

En complément de l'app mobile médecin, nous avons développé un **site web patient** complet pour la gestion de rendez-vous médicaux.

### ✨ Fonctionnalités Web

| Fonctionnalité | Description |
|---|---|
| 🔐 **Connexion OTP** | Les patients se connectent via numéro de téléphone (code OTP) |
| 👨‍⚕️ **Liste des médecins** | Consultation des praticiens avec spécialité et cabinet |
| 📅 **Réservation de créneaux** | Choix d'un créneau libre parmi les 7 prochains jours |
| 🚫 **Anti double-booking** | Transaction PostgreSQL + `SELECT FOR UPDATE` + contrainte `UNIQUE` |
| ❌ **Annulation** | Possible jusqu'à 2h avant le rendez-vous (configurable) |
| 📱 **QR Check-in** | QR code unique par RDV, scannable à l'arrivée au cabinet |
| 🩺 **Panneau médecin** | Gestion de l'emploi du temps, visualisation des arrivées, mise à jour des statuts |
| 📝 **Audit** | Journalisation de chaque action (user_id, action, timestamp) |
| 🔔 **Notifications** | Interface pluggable (mock console / Twilio SMS) |

### 🏗 Stack Technique Web

| Composant | Technologie |
|---|---|
| Frontend | **Next.js 14** + Tailwind CSS |
| Backend API | **Express** + TypeScript |
| Base de données | **PostgreSQL 16** |
| Auth | **JWT** + OTP mock |
| Déploiement | **Docker Compose** |

### 🚀 Lancer le Site Web Patient

**Prérequis** : [Docker Desktop](https://docs.docker.com/desktop/) installé et lancé.

```bash
# 1. Aller dans le dossier web-patient
cd web-patient

# 2. Lancer tous les services (DB + API + Frontend)
docker compose up --build

# 3. Dans un 2ème terminal, initialiser les données de démo
cd web-patient
docker compose exec backend npx tsx src/db/seed.ts
```

**Ouvrir le site** : 👉 **http://localhost:3000**

### 🧪 Comptes de Démo

| Rôle | Identifiant | Connexion |
|------|-------------|-----------|
| 🩺 Médecin | `doctor@tabib.dz` | mot de passe : `doctor123` → http://localhost:3000/doctor/login |
| 👤 Patient 1 | `+213555100001` (Fatima) | Code OTP affiché à l'écran → http://localhost:3000/login |
| 👤 Patient 2 | `+213555100002` (Karim) | Code OTP affiché à l'écran |
| 👤 Patient 3 | `+213555100003` (Nadia) | Code OTP affiché à l'écran |

### 📋 Scénarios de Démo

**Réserver un rendez-vous (Patient)** :
1. Ouvrir http://localhost:3000 → entrer `+213555100001` → recevoir le code OTP
2. Choisir un médecin → sélectionner une date → cliquer un créneau vert → confirmer

**Gérer l'emploi du temps (Médecin)** :
1. Ouvrir http://localhost:3000/doctor/login → `doctor@tabib.dz` / `doctor123`
2. Aller dans **Emploi du temps** → utiliser un preset ou ajouter manuellement
3. Cliquer **Enregistrer** puis **Générer les créneaux**

**Check-in le jour J** :
1. Le patient va dans **Mes RDV** → clique **Check-in maintenant**
2. Le médecin voit le statut passer à **Arrivé** dans son tableau de bord

### 🛑 Arrêter le Site

```bash
docker compose down          # arrêter les conteneurs
docker compose down -v       # arrêter ET supprimer les données
```

> Pour plus de détails, voir le [README complet du portail web](web-patient/README.md).
