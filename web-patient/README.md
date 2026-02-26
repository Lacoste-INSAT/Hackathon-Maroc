# 🏥 TabibNet — Portail Patient de Prise de Rendez-vous

Site web **patient** pour la gestion de rendez-vous médicaux, complémentaire à l'application mobile médecin existante (Snap & Sync).

**Objectif** : Réduire le temps d'attente et améliorer l'organisation des consultations en permettant aux patients de réserver leurs créneaux en ligne.

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| **Connexion OTP** | Les patients se connectent via leur numéro de téléphone (code OTP envoyé par SMS) |
| **Liste des médecins** | Consultation des praticiens disponibles avec spécialité et localisation |
| **Réservation** | Choix d'un créneau libre parmi les 7 prochains jours |
| **Anti double-booking** | Transaction PostgreSQL + `SELECT FOR UPDATE` + contrainte `UNIQUE` sur `slot_id` |
| **Annulation** | Possible jusqu'à 2h avant le rendez-vous (configurable) |
| **QR Check-in** | QR code unique généré pour chaque RDV, scannable à l'arrivée au cabinet |
| **Walk-in** | Support du type `WALK_IN` + créneaux `BLOCKED` réservables pour urgences |
| **Panneau médecin** | API REST pour gérer disponibilités, voir les arrivées, mettre à jour les statuts |
| **Audit** | Journalisation de chaque accès/action (user_id, action, timestamp) |
| **Notifications** | Interface pluggable (mock console / Twilio SMS — swap sans modifier le code) |

---

## 🏗 Stack Technique

| Composant | Technologie | Justification |
|---|---|---|
| Frontend patient | **Next.js 14** + Tailwind CSS | Routing intégré, SSR-ready, DX rapide |
| Backend API | **Node.js + Express** + TypeScript | Cohérent avec l'app mobile existante (TS) |
| Base de données | **PostgreSQL 16** | Transactions ACID pour anti double-booking |
| Auth | **JWT** + OTP (mock MVP) | Simple, stateless, compatible mobile |
| Déploiement | **Docker Compose** | Un seul `docker compose up` pour tout lancer |

---

## 🚀 Démarrage Rapide

### Prérequis

- **Docker** et **Docker Compose** installés ([Installer Docker Desktop](https://docs.docker.com/desktop/))

### Lancer le projet

```bash
# 1. Se placer dans le dossier du projet web
cd web-patient

# 2. Lancer tous les services (DB + API + Frontend)
docker compose up --build
```

### Attendre que tout démarre (~30-60 secondes)

Vous verrez dans les logs :
```
db-1        | database system is ready to accept connections
backend-1   | 🏥 TabibNet API running on port 3001
frontend-1  | ▲ Next.js 14.2.5
frontend-1  | - Local: http://localhost:3000
```

### Initialiser les données de démo

```bash
# Dans un nouveau terminal :
docker compose exec backend npx tsx src/db/seed.ts
```

### Ouvrir le site

👉 **http://localhost:3000**

---

## 🧪 Comptes de Démo

| Rôle | Identifiant | Mot de passe / OTP |
|------|-------------|-------------------|
| 🩺 Médecin | `doctor@tabib.dz` | `doctor123` |
| 👤 Patient 1 | `+213555100001` (Fatima Zahra) | Code OTP affiché à l'écran |
| 👤 Patient 2 | `+213555100002` (Karim Mansouri) | Code OTP affiché à l'écran |
| 👤 Patient 3 | `+213555100003` (Nadia Belkacem) | Code OTP affiché à l'écran |

> **Note MVP** : Le code OTP est affiché directement dans l'interface de connexion pour faciliter les tests. En production, il serait envoyé par SMS uniquement.

---

## 📋 Scénarios de Démo

### 1. Réservation d'un rendez-vous
1. Ouvrir **http://localhost:3000**
2. Entrer le numéro `+213555100001`
3. Cliquer **"Envoyer le code"**
4. Copier le code OTP affiché (encadré jaune), le coller
5. Cliquer **"Vérifier"**
6. Choisir **Dr. Ahmed Benali**
7. Sélectionner une date, puis cliquer un créneau vert
8. Confirmer → **"Rendez-vous réservé !"**

### 2. Annulation d'un rendez-vous
1. Aller dans **"Mes RDV"** via la barre de navigation
2. Cliquer **"Annuler le rendez-vous"** sur un RDV à venir
3. Confirmer → le créneau redevient libre

### 3. Check-in le jour J
1. Dans **"Mes RDV"**, un **QR code** s'affiche pour chaque RDV confirmé
2. Option A : le médecin scanne le QR avec son app mobile
3. Option B : le patient clique **"Check-in maintenant"** sur le site
4. Le statut passe à **"Arrivé"** avec horodatage

### 4. Test anti double-booking
```bash
docker compose exec backend npx jest
```
Ce test vérifie que :
- Le 1er booking sur un slot FREE réussit
- Le 2ème booking sur le même slot est rejeté (erreur PostgreSQL `23505`)
- Les tentatives concurrentes ne produisent qu'un seul booking

---

## 📡 API Endpoints

### Patient (auth JWT requise)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/auth/otp/request` | Demander un code OTP |
| `POST` | `/auth/otp/verify` | Vérifier le code → JWT |
| `GET` | `/doctors` | Liste des médecins |
| `GET` | `/doctors/:id` | Détail d'un médecin |
| `GET` | `/doctors/:id/slots?from=…&to=…` | Créneaux FREE |
| `POST` | `/appointments` | Réserver un créneau |
| `DELETE` | `/appointments/:id` | Annuler un RDV |
| `GET` | `/appointments/me` | Mes rendez-vous |
| `POST` | `/appointments/:id/checkin` | Check-in QR |

### Médecin (auth JWT + rôle DOCTOR)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/auth/doctor/login` | Connexion médecin |
| `POST` | `/doctor/availability` | Définir les règles de dispo |
| `POST` | `/doctor/slots/generate?from=…&to=…` | Générer les créneaux |
| `GET` | `/doctor/appointments?date=…` | Liste des RDV du jour |
| `PATCH` | `/doctor/appointments/:id/status` | NO_SHOW / COMPLETED / CANCELLED |
| `GET` | `/doctor/patients/:publicId/records` | Dossier patient (QR) |

---

## 🗄 Schéma Base de Données

```
users ──────────────── patients (1:1)
  │                       │
  └── doctor_profiles     ├── appointments ──── slots
        │                 │
        ├── availability  └── audit_logs
        │     _rules
        └── slots
```

**Tables principales** : `users`, `patients`, `doctor_profiles`, `availability_rules`, `slots`, `appointments`, `audit_logs`, `medical_records_web`

**Sécurité** :
- `patients.public_id` = 32 hex aléatoires (non devinable)
- `patients.qr_secret` = 64 hex aléatoires
- `appointments.qr_token` = 40 hex aléatoires (pour check-in)
- Aucun ID incrémental exposé

---

## 📁 Structure du Projet

```
web-patient/
├── docker-compose.yml          # Orchestration DB + API + Frontend
├── .env.example                # Variables d'environnement
│
├── backend/                    # API Express + TypeScript
│   ├── Dockerfile
│   ├── package.json
│   ├── jest.config.js
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── config.ts           # Configuration
│   │   ├── types.ts            # Types partagés
│   │   ├── db/
│   │   │   ├── pool.ts         # Connexion PostgreSQL
│   │   │   ├── migrate.ts      # Runner de migrations
│   │   │   ├── seed.ts         # Données de démo
│   │   │   └── migrations/
│   │   │       └── 001_initial.sql
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT + rôles
│   │   │   └── audit.ts       # Journalisation
│   │   ├── routes/
│   │   │   ├── auth.ts         # OTP + login médecin
│   │   │   ├── doctors.ts      # Liste + créneaux
│   │   │   ├── appointments.ts # CRUD rendez-vous
│   │   │   └── doctorPanel.ts  # Endpoints médecin
│   │   └── services/
│   │       ├── authService.ts
│   │       ├── slotService.ts
│   │       ├── appointmentService.ts
│   │       └── notificationService.ts
│   └── tests/
│       └── doubleBooking.test.ts
│
└── frontend/                   # Next.js 14 + Tailwind CSS
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── src/
    │   ├── types.ts
    │   ├── lib/
    │   │   ├── api.ts          # Client HTTP
    │   │   └── auth.ts         # Gestion JWT localStorage
    │   ├── components/
    │   │   ├── Navbar.tsx
    │   │   ├── SlotGrid.tsx
    │   │   ├── AppointmentCard.tsx
    │   │   └── QrCheckIn.tsx
    │   └── app/
    │       ├── layout.tsx
    │       ├── page.tsx        # Redirection auto
    │       ├── login/page.tsx
    │       ├── doctors/page.tsx
    │       ├── doctors/[id]/schedule/page.tsx
    │       └── my-appointments/page.tsx
```

---

## ⚙️ Variables d'Environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/medapp` | Connexion PostgreSQL |
| `JWT_SECRET` | `dev-jwt-secret-...` | Secret JWT (changer en prod !) |
| `FRONTEND_URL` | `http://localhost:3000` | URL frontend pour CORS |
| `PORT` | `3001` | Port de l'API |
| `CANCEL_DEADLINE_HOURS` | `2` | Heures min avant annulation |
| `SLOT_WINDOW_DAYS` | `7` | Jours de créneaux visibles |
| `TWILIO_ACCOUNT_SID` | *(vide)* | Twilio SID (optionnel) |
| `TWILIO_AUTH_TOKEN` | *(vide)* | Twilio token (optionnel) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL API pour le frontend |

---

## 🛑 Arrêter le projet

```bash
docker compose down          # Arrêter les conteneurs
docker compose down -v       # Arrêter ET supprimer les données
```
