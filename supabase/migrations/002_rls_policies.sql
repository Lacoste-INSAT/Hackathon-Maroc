-- ─────────────────────────────────────────────────────────────
-- Snap & Sync — 002: Row-Level Security Policies
-- ─────────────────────────────────────────────────────────────
-- Enables RLS on all tables and creates policies so each
-- doctor can only access their own data.
-- ─────────────────────────────────────────────────────────────

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE clinics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE records  ENABLE ROW LEVEL SECURITY;

-- ── Clinics: readable by any authenticated user ─────────────
CREATE POLICY "Clinics are readable by authenticated users"
  ON clinics FOR SELECT
  TO authenticated
  USING (true);

-- ── Doctors: read/update own row ────────────────────────────
CREATE POLICY "Doctors can read own profile"
  ON doctors FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Doctors can update own profile"
  ON doctors FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Doctors can insert own profile"
  ON doctors FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ── Patients: readable by doctors in the same clinic ────────
CREATE POLICY "Patients readable by same-clinic doctors"
  ON patients FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM doctors WHERE id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert patients in their clinic"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM doctors WHERE id = auth.uid()
    )
  );

CREATE POLICY "Doctors can update patients in their clinic"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM doctors WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM doctors WHERE id = auth.uid()
    )
  );

-- ── Sessions: CRUD scoped to own doctor_id ──────────────────
CREATE POLICY "Doctors can read own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can insert own sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- ── Records: CRUD scoped to own sessions ────────────────────
CREATE POLICY "Doctors can read own records"
  ON records FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert own records"
  ON records FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can update own records"
  ON records FOR UPDATE
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE doctor_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE doctor_id = auth.uid()
    )
  );
