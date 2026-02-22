-- ─────────────────────────────────────────────────────────────
-- Snap & Sync — 003: Storage Buckets & Policies
-- ─────────────────────────────────────────────────────────────
-- Creates the scan-images bucket with file size limits
-- and scoped upload/read policies.
-- ─────────────────────────────────────────────────────────────

-- ── Create Bucket ───────────────────────────────────────────
-- Note: In Supabase, bucket creation is done via the Dashboard
-- or the storage API. This SQL creates the policies.
-- Bucket name: scan-images
-- Max file size: 10MB
-- Allowed MIME types: image/jpeg, image/png

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scan-images',
  'scan-images',
  false,
  10485760,  -- 10MB in bytes
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ── Upload Policy ───────────────────────────────────────────
-- Doctors can upload to their own folder: scan-images/{user_id}/**
CREATE POLICY "Doctors can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Read Policy ─────────────────────────────────────────────
-- Doctors can read files from their own folder
CREATE POLICY "Doctors can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Update Policy ───────────────────────────────────────────
-- Doctors can overwrite files in their own folder
CREATE POLICY "Doctors can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Delete Policy ───────────────────────────────────────────
-- Doctors can delete files from their own folder
CREATE POLICY "Doctors can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
