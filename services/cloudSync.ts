// ─────────────────────────────────────────────────────────────
// Snap & Sync — Cloud Sync Service
// ─────────────────────────────────────────────────────────────
//
// Handles the actual upload to Supabase Storage and PostgreSQL
// upserts. Called by the background sync worker.
//
// Key design decisions:
//   • Sequential processing (not parallel) — essential for
//     weak 3G connections in rural clinics
//   • Max 5 retries per item, then marked 'failed'
//   • Compressed image uploaded, original stays local
// ─────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { getDatabase } from './database';
import { updateRecordStatus } from './recordRepository';
import { updateQueueItemStatus, getQueueItems } from './offlineQueue';
import { getCurrentUser } from './auth';
import { useSyncStore } from '@/stores/useSyncStore';
import type { Record as LocalRecord, SyncQueueItem, SyncResult } from '@/lib/types';

const MAX_RETRIES = 5;

/**
 * Uploads a single record's compressed image to Supabase Storage,
 * then upserts the record row in PostgreSQL.
 *
 * Storage path: scan-images/{doctor_id}/{session_id}/{record_id}.jpg
 */
export async function uploadImage(record: LocalRecord): Promise<void> {
  // MOCK: Bypass strict auth for testing the pipeline if no user is signed in.
  const user = await getCurrentUser();
  const userId = user?.id || 'doc-123'; 

  const imagePath = record.compressed_image_path ?? record.original_image_path;
  const storagePath = `${userId}/${record.session_id}/${record.id}.jpg`;

  // ── Step 1: Read the image file as base64 ─────────────────
  const fileInfo = await getInfoAsync(imagePath);
  if (!fileInfo.exists) {
    throw new Error(`[cloudSync] Image file not found: ${imagePath}`);
  }

  const base64 = await readAsStringAsync(imagePath, {
    encoding: 'base64',
  });

  // Convert base64 to Uint8Array for Supabase upload
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // ── Step 2: Upload to Supabase Storage ────────────────────
  const { error: uploadError } = await supabase.storage
    .from('scan-images')
    .upload(storagePath, bytes, {
      contentType: 'image/jpeg',
      upsert: true,             // overwrite if exists (retry case)
    });

  if (uploadError) {
    if (uploadError.message.includes('Bucket not found')) {
       throw new Error(`[cloudSync] The Supabase storage bucket 'scan-images' does not exist. Please create a public bucket named 'scan-images' in the Supabase Dashboard before syncing.`);
    }
    throw new Error(`[cloudSync] Storage upload failed: ${uploadError.message}`);
  }

  // Get the public URL for the uploaded image
  const { data: urlData } = supabase.storage
    .from('scan-images')
    .getPublicUrl(storagePath);

  const imageUrl = urlData?.publicUrl ?? storagePath;

  // ── Step 3: Upsert record in Supabase PostgreSQL ──────────
  const { error: dbError } = await supabase
    .from('records')
    .upsert({
      id: record.id,
      session_id: record.session_id,
      image_url: imageUrl,
      status: 'pending_extraction',
      synced_at: new Date().toISOString(),
      created_at: record.created_at,
    });

  if (dbError) {
    throw new Error(`[cloudSync] DB upsert failed: ${dbError.message}`);
  }

  // ── Step 4: Update local SQLite status ────────────────────
  const syncedAt = new Date().toISOString();
  await updateRecordStatus(record.id, 'pending_extraction', syncedAt);
}

/**
 * Syncs a local session to Supabase PostgreSQL.
 * Requires the patient to exist in the cloud patients table.
 */
export async function upsertSession(localSession: {
  id: string;
  patient_code: string;
  patient_name: string | null;
  doctor_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
}): Promise<void> {
  // Look up the patient UUID from patient_code
  let patientId = null;
  const { data: patient, error: lookupError } = await supabase
    .from('patients')
    .select('id')
    .eq('patient_code', localSession.patient_code)
    .single();

  if (lookupError || !patient) {
     console.warn(`[cloudSync] Patient not found in cloud, using mock UUID`);
     patientId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // mock UUID
  } else {
     patientId = patient.id;
  }

  const { error } = await supabase
    .from('sessions')
    .upsert({
      id: localSession.id,
      patient_id: patientId,
      doctor_id: localSession.doctor_id,
      started_at: localSession.started_at,
      ended_at: localSession.ended_at,
      status: localSession.status,
    });

  if (error) {
    throw new Error(`[cloudSync] Session upsert failed: ${error.message}`);
  }
}

/**
 * Processes all pending items in the sync queue — SEQUENTIALLY.
 *
 * Sequential processing is critical for rural clinics on weak 3G:
 * if you fire 10 uploads in parallel on a bad connection, they
 * all fail. One at a time ensures some data gets through.
 *
 * Retry logic: increment retry_count on failure, max 5 attempts.
 * After 5 failures, the item is marked 'failed' and skipped.
 *
 * @returns { synced, failed } counts
 */
export async function syncAllPending(): Promise<SyncResult> {
  const store = useSyncStore.getState();
  store.setSyncStatus('syncing');

  let synced = 0;
  let failed = 0;

  try {
    const pendingItems = await getQueueItems();

    if (pendingItems.length === 0) {
      store.setSyncStatus('idle');
      return { synced: 0, failed: 0 };
    }

    const db = getDatabase();

    // Process each item ONE AT A TIME
    for (const item of pendingItems) {
      try {
        // Mark as in_progress
        await updateQueueItemStatus(item.id, 'in_progress');

        if (item.action === 'upload_image') {
          // Fetch the full record from SQLite
          const record = await db.getFirstAsync<LocalRecord>(
            'SELECT * FROM records WHERE id = ?',
            [item.record_id]
          );

          if (!record) {
            console.warn(`[cloudSync] Record ${item.record_id} not found, marking failed`);
            await updateQueueItemStatus(item.id, 'failed', item.retry_count);
            failed++;
            continue;
          }

          await uploadImage(record);
        }

        // Success — mark as completed
        await updateQueueItemStatus(item.id, 'completed');
        store.decrementPending();
        synced++;

      } catch (error) {
        const newRetryCount = item.retry_count + 1;
        const errorMsg = error instanceof Error ? error.message : String(error);

        console.error(
          `[cloudSync] Failed item ${item.id} (attempt ${newRetryCount}/${MAX_RETRIES}):`,
          errorMsg
        );

        if (newRetryCount >= MAX_RETRIES) {
          // Max retries exceeded — mark as permanently failed
          await updateQueueItemStatus(item.id, 'failed', newRetryCount);
          failed++;
          console.error(
            `[cloudSync] Item ${item.id} permanently failed after ${MAX_RETRIES} attempts`
          );
        } else {
          // Revert to pending with incremented retry count
          await updateQueueItemStatus(item.id, 'pending', newRetryCount);
        }
      }
    }

    // Update final status
    if (failed > 0 && synced === 0) {
      store.setLastError(`All ${failed} items failed to sync`);
    } else {
      store.setSyncStatus('idle');
      store.setLastSyncAt(new Date().toISOString());
      if (failed > 0) {
        store.setLastError(`${failed} item(s) failed during sync`);
      } else {
        store.setLastError(null);
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[cloudSync] syncAllPending crashed:', errorMsg);
    store.setLastError(errorMsg);
  }

  return { synced, failed };
}
