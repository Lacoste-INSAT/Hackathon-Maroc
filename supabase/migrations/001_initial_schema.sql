-- ─────────────────────────────────────────────────────────────
-- Snap & Sync — 001: Initial PostgreSQL Schema
-- ─────────────────────────────────────────────────────────────
-- Run against your Supabase project via the SQL Editor or CLI.
-- ─────────────────────────────────────────────────────────────

-- ── Clinics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  location   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Doctors ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id         UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name  TEXT NOT NULL,
  clinic_id  UUID REFERENCES clinics(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Patients ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code  TEXT UNIQUE NOT NULL,         -- e.g. "AHM-924"
  full_name     TEXT NOT NULL,
  date_of_birth DATE,
  gender        TEXT CHECK (gender IN ('M', 'F', 'Other')),
  clinic_id     UUID REFERENCES clinics(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id  UUID NOT NULL REFERENCES doctors(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ,
  status     TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Records ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES sessions(id),
  image_url            TEXT,                   -- Supabase Storage path
  extracted_data       JSONB,
  overall_confidence   FLOAT,
  prediction_score     FLOAT,
  status               TEXT CHECK (status IN (
                          'pending_sync',
                          'pending_extraction',
                          'needs_review',
                          'approved'
                        )) DEFAULT 'pending_sync',
  flagged_reason       TEXT,
  doctor_corrections   JSONB,
  synced_at            TIMESTAMPTZ,
  extracted_at         TIMESTAMPTZ,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_code    ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor  ON sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_records_session  ON records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_status   ON records(status);
