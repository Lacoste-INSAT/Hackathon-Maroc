-- ─────────────────────────────────────────────────────────────
-- Snap & Sync — 004: Patient Demographics & pgvector Second Brain
-- ─────────────────────────────────────────────────────────────

-- ── 1. Demographics Updates ─────────────────────────────────
-- date_of_birth already exists in 001_initial_schema.sql.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS biological_sex VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_type VARCHAR;

-- ── 2. Vector Extension & Embeddings ────────────────────────
-- Enable the pgvector extension to work with vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to records (Gemini text-embedding-004 outputs 768 dimensions)
ALTER TABLE records ADD COLUMN IF NOT EXISTS embedding vector(768);

-- ── 3. Vector Similarity Search Function ────────────────────
-- Create a function to find similar clinical records based on cosine distance.
-- Cosine distance is used because normalized vectors (which Gemini embeddings typically are)
-- perform well with it. The similarity score is derived as 1 - distance.
CREATE OR REPLACE FUNCTION match_clinical_records(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  patient_filter uuid DEFAULT null
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  extracted_data jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    records.id,
    records.session_id,
    records.extracted_data,
    1 - (records.embedding <=> query_embedding) AS similarity
  FROM records
  WHERE records.embedding IS NOT NULL
    AND records.status = 'approved'
    AND (patient_filter IS NULL OR records.session_id IN (SELECT id FROM sessions WHERE patient_id = patient_filter))
    AND 1 - (records.embedding <=> query_embedding) > match_threshold
  ORDER BY records.embedding <=> query_embedding
  LIMIT match_count;
$$;
