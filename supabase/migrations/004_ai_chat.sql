-- ─────────────────────────────────────────────────────────────
-- Snap & Sync — 004: AI Chat Tables & RLS
-- ─────────────────────────────────────────────────────────────

-- ── ai_conversations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  doctor_id       UUID NOT NULL REFERENCES doctors(id),
  title           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_doctor
  ON ai_conversations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_patient
  ON ai_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_msg
  ON ai_conversations(last_message_at DESC);

-- ── ai_messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('doctor', 'assistant')),
  content           TEXT NOT NULL,
  source_record_ids JSONB DEFAULT '[]'::jsonb,
  model             TEXT,
  latency_ms        INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON ai_messages(conversation_id, created_at ASC);

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages      ENABLE ROW LEVEL SECURITY;

-- ── ai_conversations policies ───────────────────────────────
CREATE POLICY "Doctors can read own conversations"
  ON ai_conversations FOR SELECT
  TO authenticated
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can insert own conversations"
  ON ai_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    doctor_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM doctors WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_id AND p.clinic_id = clinic_id)
  );

CREATE POLICY "Doctors can update own conversations"
  ON ai_conversations FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- ── ai_messages policies ────────────────────────────────────
CREATE POLICY "Doctors can read messages from own conversations"
  ON ai_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert messages into own conversations"
  ON ai_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE doctor_id = auth.uid()
    )
  );

-- ── Service role bypass (for Edge Functions) ────────────────
CREATE POLICY "Service role full access to ai_conversations"
  ON ai_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to ai_messages"
  ON ai_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
