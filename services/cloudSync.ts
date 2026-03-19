// ─────────────────────────────────────────────────────────────
// Snap & Sync — Cloud Sync Service
// ─────────────────────────────────────────────────────────────
//
// LINEAR API-STYLE REWRITE
//
// Handles the actual upload to Supabase Storage and PostgreSQL
// upserts. Called by the background sync worker.
//
// Key design decisions:
//   • Sequential processing
//   • Auto-creates patient if missing (Hackathon Bypass)
//   • Linear steps for easy debugging
// ─────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { getDatabase } from './database';
import { getSessionById } from './sessionRepository';
import { getRecordById, updateRecordExtraction, updateRecordStatus } from './recordRepository';
import { updateQueueItemStatus, getQueueItems, retryFailedItem } from './offlineQueue';
import { getCurrentUser } from './auth';
import { useSyncStore } from '@/stores/useSyncStore';
import type { Record as LocalRecord, RecordStatus, SyncQueueItem, SyncResult } from '@/lib/types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const MAX_RETRIES = 5;

/**
 * Step A: Ensure patient exists on Supabase.
 * If not, auto-creates a patient using the code as ID/name to unblock the queue!
 */
async function ensurePatientExists(patientCode: string): Promise<string> {
  // 1. Check if patient exists
  const { data: patient, error: lookupError } = await supabase
    .from('patients')
    .select('id')
    .eq('patient_code', patientCode)
    .single();

  if (!lookupError && patient) {
    return patient.id; // Patient exists, return ID
  }

  // 2. Patient doesn't exist! (Hackathon bypass: Auto-create)
  console.warn(`[cloudSync] Patient code ${patientCode} not found in cloud! AUTO-CREATING...`);
  
  const newPatientId = uuidv4();
  
  const { error: insertError } = await supabase
    .from('patients')
    .insert({
      id: newPatientId,
      patient_code: patientCode,
      full_name: `Hackathon Auto-Patient (${patientCode})`, // default name
      date_of_birth: null,
      gender: null,
    });

  if (insertError) {
    throw new Error(`[cloudSync] Step A Failed: Could not auto-create patient: ${insertError.message}`);
  }

  return newPatientId;
}

/**
 * Step B: Insert the Session into Supabase
 */
async function insertSession(session: any, patientId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .upsert({
      id: session.id,
      patient_id: patientId,
      doctor_id: session.doctor_id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      status: session.status,
    });

  if (error) {
    throw new Error(`[cloudSync] Step B Failed: Session upsert failed: ${error.message}`);
  }
}

/**
 * Step C: Upload the Image to scan-images bucket
 */
async function uploadToStorage(record: LocalRecord, userId: string): Promise<string> {
  const imagePath = record.compressed_image_path ?? record.original_image_path;
  const storagePath = `${userId}/${record.session_id}/${record.id}.jpg`;

  const fileInfo = await getInfoAsync(imagePath);
  if (!fileInfo.exists) {
    throw new Error(`[cloudSync] Step C Failed: Image file not found: ${imagePath}`);
  }

  const base64 = await readAsStringAsync(imagePath, { encoding: 'base64' });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from('scan-images')
    .upload(storagePath, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    if (uploadError.message.includes('Bucket not found')) {
       throw new Error(`[cloudSync] Step C Failed: The Supabase storage bucket 'scan-images' does not exist.`);
    }
    throw new Error(`[cloudSync] Step C Failed: Storage upload failed: ${uploadError.message}`);
  }

  return storagePath;
}

/**
 * Step D: Get Public URL and upsert Record
 */
async function upsertRecord(record: LocalRecord, storagePath: string): Promise<string> {
  // Keep storage object path in image_url because edge extraction downloads by bucket path.
  const imageUrl = storagePath;

  let extractedDataForCloud: unknown = null;
  let correctionsForCloud: unknown = null;

  if (record.extracted_data) {
    try {
      extractedDataForCloud = JSON.parse(record.extracted_data);
    } catch {
      extractedDataForCloud = null;
    }
  }

  if (record.doctor_corrections) {
    try {
      correctionsForCloud = JSON.parse(record.doctor_corrections);
    } catch {
      correctionsForCloud = null;
    }
  }

  const cloudStatus: RecordStatus = record.overall_confidence !== null
    ? record.overall_confidence >= 80
      ? 'approved'
      : 'needs_review'
    : 'pending_extraction';

  const { error: dbError } = await supabase
    .from('records')
    .upsert({
      id: record.id,
      session_id: record.session_id,
      image_url: imageUrl,
      extracted_data: extractedDataForCloud,
      overall_confidence: record.overall_confidence,
      doctor_corrections: correctionsForCloud,
      status: cloudStatus,
      synced_at: new Date().toISOString(),
      created_at: record.created_at,
    });

  if (dbError) {
    throw new Error(`[cloudSync] Step D Failed: Record DB upsert failed: ${dbError.message}`);
  }

  console.log(`[cloudSync] Record ${record.id} synced successfully (AI handled on client).`);

  return record.id;
}


/**
 * Processes a single pending item from start to finish
 */
async function processItem(item: SyncQueueItem, db: any): Promise<void> {
  console.log(`[cloudSync] Processing queue item ${item.id} (Action: ${item.action})`);

  if (item.action !== 'upload_image') {
    return; // Ignore other action types for now if any
  }

  // 0. Initial Setup
  const user = await getCurrentUser();
  const userId = user ? user.id : '00000000-0000-0000-0000-000000000000';

  const record = await db.getFirstAsync(
    'SELECT * FROM records WHERE id = ?',
    [item.record_id]
  ) as LocalRecord | null;

  if (!record) {
    throw new Error(`[cloudSync] Record ${item.record_id} not found in local DB`);
  }

  const session = await db.getFirstAsync(
    'SELECT * FROM sessions WHERE id = ?',
    [record.session_id]
  );
  
  if (!session) {
    throw new Error(`[cloudSync] Session ${record.session_id} not found locally!`);
  }

  // ── THE PIPELINE ──

  // Step A: Ensure patient exists
  const patientId = await ensurePatientExists(session.patient_code);

  // Step B: Insert Session
  await insertSession(session, patientId);
  await db.runAsync('UPDATE sessions SET synced = 1 WHERE id = ?', [session.id]);

  // Step C: Upload Image to Storage
  const storagePath = await uploadToStorage(record, userId);

  // Step D: Upsert cloud record before any server-side extraction.
  await upsertRecord(record, storagePath);

  // Step C.5: AI Extraction (if missing, means we captured offline)
  let finalConfidence = record.overall_confidence ?? 0;
  let finalStatus: RecordStatus = finalConfidence >= 80 ? 'approved' : 'needs_review';

  if (!record.extracted_data) {
    console.log('[EXTRACTION] Triggering server extraction for record:', record.id);

    const { error: extractInvokeError } = await supabase.functions.invoke('extract-handwriting', {
      body: { record_id: record.id },
    });

    if (extractInvokeError) {
      throw new Error(`[cloudSync] Step C.5 Failed: Edge extraction invoke failed: ${extractInvokeError.message}`);
    }

    const { data: cloudRecord, error: cloudRecordErr } = await supabase
      .from('records')
      .select('extracted_data, overall_confidence, flagged_reason, status')
      .eq('id', record.id)
      .single();

    if (cloudRecordErr || !cloudRecord) {
      throw new Error(`[cloudSync] Step C.5 Failed: Could not fetch extraction result: ${cloudRecordErr?.message ?? 'unknown error'}`);
    }

    if (cloudRecord.extracted_data && typeof cloudRecord.overall_confidence === 'number') {
      await updateRecordExtraction(
        record.id,
        typeof cloudRecord.extracted_data === 'string'
          ? cloudRecord.extracted_data
          : JSON.stringify(cloudRecord.extracted_data),
        cloudRecord.overall_confidence,
        cloudRecord.flagged_reason ?? null
      );
      finalConfidence = cloudRecord.overall_confidence;
      finalStatus = finalConfidence >= 80 ? 'approved' : 'needs_review';
      console.log(`[EXTRACTION] Server extraction saved locally (${finalConfidence}%)`);
    } else {
      finalStatus = cloudRecord.status === 'approved' ? 'approved' : 'needs_review';
      finalConfidence = 0;
      console.warn('[cloudSync] Edge extraction finished without extracted_data payload; keeping needs_review status locally.');
    }
  }

  await updateRecordStatus(record.id, finalStatus, new Date().toISOString());
}


/**
 * Main Entry Point:
 * Processes all pending items in the sync queue — SEQUENTIALLY.
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
        await updateQueueItemStatus(item.id, 'in_progress');

        // 🔥 Execute the linear pipeline
        await processItem(item, db);

        // Success — mark as completed
        await updateQueueItemStatus(item.id, 'completed');
        store.decrementPending();
        synced++;

      } catch (error) {
        const newRetryCount = item.retry_count + 1;
        const errorMsg = error instanceof Error ? error.message : String(error);

        console.error(`[cloudSync] Failed item ${item.id} (attempt ${newRetryCount}/${MAX_RETRIES}):`, errorMsg);

        if (newRetryCount >= MAX_RETRIES) {
           await updateQueueItemStatus(item.id, 'failed', newRetryCount);
           failed++;
           console.error(`[cloudSync] Item ${item.id} permanently failed.`);
        } else {
           await updateQueueItemStatus(item.id, 'pending', newRetryCount);
        }
      }
    }

    // Wrap up
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
