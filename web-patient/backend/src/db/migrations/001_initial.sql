-- ─────────────────────────────────────────────────────────────
-- TabibNet — 001: Initial PostgreSQL Schema
-- ─────────────────────────────────────────────────────────────
-- Idempotent: all CREATE use IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users (doctors + patients) ──────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            TEXT NOT NULL CHECK (role IN ('DOCTOR', 'PATIENT')),
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT UNIQUE,
  password_hash   TEXT,
  otp_code        TEXT,
  otp_expires_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Patient Profiles ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_id     TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  qr_secret     TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  patient_code  TEXT UNIQUE,
  date_of_birth DATE,
  gender        TEXT CHECK (gender IN ('M', 'F', 'Other')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Doctor Profiles ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS doctor_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty   TEXT,
  clinic_name TEXT,
  bio         TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Availability Rules ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS availability_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id             UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  day_of_week           INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  slot_duration_minutes INT NOT NULL DEFAULT 20,
  created_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- ── Time Slots ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  start_datetime  TIMESTAMPTZ NOT NULL,
  end_datetime    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'FREE'
                    CHECK (status IN ('FREE', 'BOOKED', 'BLOCKED', 'RESERVED', 'CANCELLED')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (doctor_id, start_datetime)
);

-- ── Appointments ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  slot_id     UUID UNIQUE NOT NULL REFERENCES slots(id),
  type        TEXT NOT NULL DEFAULT 'SCHEDULED'
                CHECK (type IN ('SCHEDULED', 'WALK_IN')),
  status      TEXT NOT NULL DEFAULT 'BOOKED'
                CHECK (status IN ('BOOKED', 'CANCELLED', 'ARRIVED', 'NO_SHOW', 'COMPLETED')),
  checkin_at  TIMESTAMPTZ,
  qr_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(20), 'hex'),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Audit Logs ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES users(id),
  patient_id      UUID REFERENCES patients(id),
  action          TEXT NOT NULL,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Medical Records (metadata for web patient portal) ───────

CREATE TABLE IF NOT EXISTS medical_records_web (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES doctor_profiles(id),
  record_type TEXT CHECK (record_type IN ('prescription', 'analysis', 'note')),
  title       TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone          ON users(phone);
CREATE INDEX IF NOT EXISTS idx_patients_public_id   ON patients(public_id);
CREATE INDEX IF NOT EXISTS idx_patients_user_id     ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_code        ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_doctor_user_id       ON doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_status  ON slots(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_slots_datetime       ON slots(start_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor  ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_slot    ON appointments(slot_id);
CREATE INDEX IF NOT EXISTS idx_appointments_qr      ON appointments(qr_token);
CREATE INDEX IF NOT EXISTS idx_audit_actor          ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient        ON audit_logs(patient_id);
