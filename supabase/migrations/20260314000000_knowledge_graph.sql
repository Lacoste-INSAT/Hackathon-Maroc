-- Migration 005: Knowledge Graph upgrade
-- DO NOT create kg_visit_embeddings — records table already has embedding vector(768)
-- DO NOT create kg_nodes or kg_edges — premature

-- Drop old tables just in case they were created in a botched run
DROP TABLE IF EXISTS kg_edges;
DROP TABLE IF EXISTS kg_nodes;

-- 1. Add structured entity columns to existing records table
ALTER TABLE records ADD COLUMN IF NOT EXISTS diagnoses   TEXT[] DEFAULT '{}';
ALTER TABLE records ADD COLUMN IF NOT EXISTS drugs       TEXT[] DEFAULT '{}';
ALTER TABLE records ADD COLUMN IF NOT EXISTS symptoms    TEXT[] DEFAULT '{}';

-- 2. Drop and replace the existing RPC to return the new fields
--    and join back to patients for cross-patient matching
CREATE OR REPLACE FUNCTION match_clinical_records(
  query_embedding vector(768),
  match_count     int   DEFAULT 3
)
RETURNS TABLE (
  id               uuid,
  session_id       uuid,
  patient_id       uuid,
  diagnoses        text[],
  drugs            text[],
  symptoms         text[],
  extracted_data   jsonb,
  similarity       float
)
LANGUAGE sql STABLE AS $$
  SELECT
    r.id,
    r.session_id,
    s.patient_id,
    r.diagnoses,
    r.drugs,
    r.symptoms,
    r.extracted_data,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM records r
  JOIN sessions s ON s.id = r.session_id
  WHERE r.embedding IS NOT NULL
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_records_embedding
  ON records USING hnsw (embedding vector_cosine_ops);
