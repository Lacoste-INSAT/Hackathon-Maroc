-- Hackathon synthetic seed: 30 patients for Knowledge Graph matching
-- Inserts only. No schema changes.

BEGIN;

WITH profile_defs AS (
  SELECT *
  FROM (
    VALUES
      ('A', ARRAY['Hypertension','Type 2 Diabetes Mellitus']::text[], ARRAY['Amlodipine 5mg','Metformin 500mg','Ramipril 10mg']::text[], ARRAY['headache','fatigue','polyuria']::text[]),
      ('B', ARRAY['Chronic Low Back Pain','Fibromyalgia']::text[], ARRAY['Tramadol 50mg','Ibuprofen 400mg','Paracetamol 1000mg']::text[], ARRAY['back pain','joint pain','insomnia']::text[]),
      ('C', ARRAY['Coronary Artery Disease','Hyperlipidemia']::text[], ARRAY['Atorvastatin 20mg','Aspirin 100mg','Amlodipine 10mg']::text[], ARRAY['chest tightness','dyspnea on exertion','fatigue']::text[]),
      ('D', ARRAY['Asthma','Allergic Rhinitis']::text[], ARRAY['Salbutamol 100mcg','Fluticasone 250mcg','Cetirizine 10mg']::text[], ARRAY['dyspnea','wheezing','nasal congestion']::text[]),
      ('E', ARRAY['Gastroesophageal Reflux Disease','Irritable Bowel Syndrome']::text[], ARRAY['Omeprazole 20mg','Mebeverine 135mg']::text[], ARRAY['heartburn','bloating','abdominal pain']::text[]),
      ('F', ARRAY['Major Depressive Disorder','Generalized Anxiety Disorder']::text[], ARRAY['Sertraline 50mg','Alprazolam 0.5mg']::text[], ARRAY['low mood','anxiety','insomnia','fatigue']::text[]),
      ('G', ARRAY['Gout','Chronic Kidney Disease Stage 2']::text[], ARRAY['Allopurinol 100mg','Furosemide 40mg','Bicarbonate']::text[], ARRAY['joint swelling','foot pain','edema']::text[]),
      ('H', ARRAY['Acute Viral Rhinitis','Pharyngitis']::text[], ARRAY['Paracetamol 500mg','Amoxicillin 500mg','Vitamin C']::text[], ARRAY['fever','sore throat','rhinorrhea','malaise']::text[])
  ) AS t(profile_key, diagnoses, medications, symptoms)
),
seed_map AS (
  SELECT *
  FROM (
    VALUES
      (1, 'A'), (2, 'A'), (3, 'A'), (4, 'A'), (5, 'A'), (6, 'A'),
      (7, 'B'), (8, 'B'), (9, 'B'), (10, 'B'), (11, 'B'),
      (12, 'C'), (13, 'C'), (14, 'C'), (15, 'C'),
      (16, 'D'), (17, 'D'), (18, 'D'), (19, 'D'),
      (20, 'E'), (21, 'E'), (22, 'E'),
      (23, 'F'), (24, 'F'), (25, 'F'),
      (26, 'G'), (27, 'G'), (28, 'G'),
      (29, 'H'), (30, 'H')
  ) AS s(seed_no, profile_key)
),
patient_source AS (
  SELECT
    sm.seed_no,
    sm.profile_key,
    format('SYN-%03s', sm.seed_no) AS patient_code,
    format('Synthetic Patient %s', lpad(sm.seed_no::text, 2, '0')) AS full_name,
    (DATE '1960-01-01' + (sm.seed_no * 160))::date AS date_of_birth,
    CASE
      WHEN sm.seed_no % 3 = 0 THEN 'Other'
      WHEN sm.seed_no % 2 = 0 THEN 'F'
      ELSE 'M'
    END AS gender,
    (TIMESTAMP '2025-09-05 09:00:00' + ((sm.seed_no * 5) || ' days')::interval) AS visit_ts,
    pd.diagnoses,
    pd.medications,
    pd.symptoms,
    (90 + (sm.seed_no % 8)) AS diag_conf_1,
    (88 + ((sm.seed_no + 1) % 8)) AS diag_conf_2,
    (89 + (sm.seed_no % 7)) AS med_conf_base,
    (85 + (sm.seed_no % 9)) AS sym_conf_base,
    (89 + (sm.seed_no % 8)) AS overall_conf
  FROM seed_map sm
  JOIN profile_defs pd ON pd.profile_key = sm.profile_key
),
inserted_patients AS (
  INSERT INTO patients (
    id,
    patient_code,
    full_name,
    date_of_birth,
    gender
  )
  SELECT
    gen_random_uuid(),
    ps.patient_code,
    ps.full_name,
    ps.date_of_birth,
    ps.gender
  FROM patient_source ps
  RETURNING id, patient_code
),
patient_enriched AS (
  SELECT
    ip.id AS patient_id,
    ps.seed_no,
    ps.patient_code,
    ps.visit_ts,
    ps.diagnoses,
    ps.medications,
    ps.symptoms,
    ps.diag_conf_1,
    ps.diag_conf_2,
    ps.med_conf_base,
    ps.sym_conf_base,
    ps.overall_conf
  FROM inserted_patients ip
  JOIN patient_source ps ON ps.patient_code = ip.patient_code
),
inserted_sessions AS (
  INSERT INTO sessions (
    id,
    patient_id,
    doctor_id,
    started_at,
    ended_at,
    status
  )
  SELECT
    gen_random_uuid(),
    pe.patient_id,
    '00000000-0000-0000-0000-000000000001'::uuid,
    pe.visit_ts,
    pe.visit_ts + INTERVAL '35 minutes',
    'completed'
  FROM patient_enriched pe
  RETURNING id, patient_id
)
INSERT INTO records (
  id,
  session_id,
  image_url,
  extracted_data,
  overall_confidence,
  status,
  flagged_reason,
  doctor_corrections,
  created_at,
  synced_at,
  diagnoses,
  drugs,
  symptoms,
  embedding
)
SELECT
  gen_random_uuid(),
  s.id,
  NULL,
  jsonb_build_object(
    'fields',
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'label', 'Diagnosis',
              'value', d,
              'confidence', LEAST(97, pe.diag_conf_1 + ord - 1)
            )
          ),
          '[]'::jsonb
        )
        FROM unnest(pe.diagnoses) WITH ORDINALITY AS diag(d, ord)
      )
      ||
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'label', 'Medication',
              'value', m,
              'confidence', LEAST(97, pe.med_conf_base + ord - 1)
            )
          ),
          '[]'::jsonb
        )
        FROM unnest(pe.medications) WITH ORDINALITY AS med(m, ord)
      )
      ||
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'label', 'Symptom',
              'value', sym,
              'confidence', LEAST(97, pe.sym_conf_base + ord - 1)
            )
          ),
          '[]'::jsonb
        )
        FROM unnest(pe.symptoms) WITH ORDINALITY AS sy(sym, ord)
      ),
    'overallConfidence', pe.overall_conf
  ),
  pe.overall_conf::float,
  'needs_review',
  NULL,
  NULL,
  pe.visit_ts,
  pe.visit_ts + INTERVAL '2 minutes',
  pe.diagnoses,
  pe.medications,
  pe.symptoms,
  NULL
FROM inserted_sessions s
JOIN patient_enriched pe ON pe.patient_id = s.patient_id;

COMMIT;
