// ─────────────────────────────────────────────────────────────
// Snap & Sync — Record Repository (SQLite CRUD)
// ─────────────────────────────────────────────────────────────

import { getDatabase } from './database';
import type { Record, RecordStatus } from '@/lib/types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new record with image paths and returns its UUID.
 * The original_image_path is always required (doctor's visual reference).
 */
export async function createRecord(
  sessionId: string,
  originalImagePath: string,
  compressedImagePath?: string | null
): Promise<string> {
  const db = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO records
       (id, session_id, original_image_path, compressed_image_path, status, created_at)
     VALUES (?, ?, ?, ?, 'pending_sync', ?)`,
    [id, sessionId, originalImagePath, compressedImagePath ?? null, createdAt]
  );

  return id;
}

/**
 * Returns all records for a given session, ordered by creation time.
 */
export async function getRecordsBySession(sessionId: string): Promise<Record[]> {
  const db = getDatabase();
  return db.getAllAsync<Record>(
    `SELECT * FROM records WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );
}

/**
 * Returns all records with status = 'pending_sync'.
 */
export async function getPendingSyncRecords(): Promise<Record[]> {
  const db = getDatabase();
  return db.getAllAsync<Record>(
    `SELECT * FROM records WHERE status = 'pending_sync' ORDER BY created_at ASC`,
    []
  );
}

/**
 * Returns all records that need doctor review.
 */
export async function getNeedsReviewRecords(): Promise<Record[]> {
  const db = getDatabase();
  return db.getAllAsync<Record>(
    `SELECT * FROM records WHERE status = 'needs_review' ORDER BY created_at ASC`,
    []
  );
}

/**
 * Updates the status of a record. Optionally sets synced_at.
 */
export async function updateRecordStatus(
  recordId: string,
  status: RecordStatus,
  syncedAt?: string | null
): Promise<void> {
  const db = getDatabase();

  if (syncedAt) {
    await db.runAsync(
      `UPDATE records SET status = ?, synced_at = ? WHERE id = ?`,
      [status, syncedAt, recordId]
    );
  } else {
    await db.runAsync(
      `UPDATE records SET status = ? WHERE id = ?`,
      [status, recordId]
    );
  }
}

/**
 * Saves AI extraction results to a record.
 */
export async function updateRecordExtraction(
  recordId: string,
  extractedData: string,     // JSON string of ExtractionResult
  overallConfidence: number,
  flaggedReason?: string | null
): Promise<void> {
  const db = getDatabase();

  const status: RecordStatus = overallConfidence >= 80
    ? 'approved'
    : 'needs_review';

  await db.runAsync(
    `UPDATE records
     SET extracted_data = ?, overall_confidence = ?, status = ?,
         flagged_reason = ?
     WHERE id = ?`,
    [extractedData,
    overallConfidence,
    status,
    flaggedReason ?? null,
    recordId]
  );
}

/**
 * Saves doctor corrections to a record and marks it approved.
 */
export async function updateRecordCorrections(
  recordId: string,
  corrections: string        // JSON string of corrected fields
): Promise<void> {
  const db = getDatabase();
  const reviewedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE records
     SET doctor_corrections = ?, status = 'approved', synced_at = ?
     WHERE id = ?`,
    [corrections, reviewedAt, recordId]
  );
}

/**
 * Gets a single record by ID.
 */
export async function getRecordById(recordId: string): Promise<Record | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Record>(
    `SELECT * FROM records WHERE id = ?`,
    [recordId]
  );
  return row ?? null;
}

/**
 * Returns the count of records with a given status.
 */
export async function getRecordCountByStatus(
  status: RecordStatus
): Promise<number> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM records WHERE status = ?`,
    [status]
  );
  return row?.count ?? 0;
}
