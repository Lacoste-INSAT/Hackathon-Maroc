// ─────────────────────────────────────────────────────────────
// Snap & Sync — Offline Queue Manager
// ─────────────────────────────────────────────────────────────
//
// Connects the camera capture flow to the sync pipeline:
//   enqueuePhoto() → SQLite record + sync_queue entry
//
// The backgroundSync worker picks up from sync_queue automatically.
// ─────────────────────────────────────────────────────────────

import { getDatabase } from './database';
import { createRecord } from './recordRepository';
import type { SyncQueueItem, QueueStats } from '@/lib/types';

/**
 * Enqueues a photo for sync. This is the main entry point
 * called after a doctor captures a document photo.
 *
 * Flow:
 *   1. Creates a record in SQLite with status='pending_sync'
 *   2. Adds an entry to sync_queue with action='upload_image'
 *   3. Returns the record ID
 *
 * The original photo path is always stored so the doctor
 * can view it even before sync/AI runs.
 *
 * @param sessionId    – Active session UUID
 * @param originalUri  – Full-res photo URI on device
 * @param compressedUri – 150-200KB compressed version (optional)
 * @returns Record ID (UUID)
 */
export async function enqueuePhoto(
  sessionId: string,
  originalUri: string,
  compressedUri?: string | null
): Promise<string> {
  const db = getDatabase();

  // Step 1: create the record in SQLite
  const recordId = await createRecord(sessionId, originalUri, compressedUri);

  // Step 2: add to sync queue
  await db.runAsync(
    `INSERT INTO sync_queue (record_id, action, retry_count, status)
     VALUES (?, 'upload_image', 0, 'pending')`,
    [recordId]
  );

  return recordId;
}

/**
 * Returns stats about the current sync queue.
 */
export async function getQueueStats(): Promise<QueueStats> {
  const db = getDatabase();

  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'in_progress')`
  );

  // Estimate total size from compressed images (if available) or originals
  // This is an approximation — actual file size reading would need expo-file-system
  const pendingCount = countRow?.count ?? 0;

  // Rough estimate: average compressed image ≈ 180KB
  const estimatedSizeKB = pendingCount * 180;

  return {
    pendingCount,
    totalSizeKB: estimatedSizeKB,
  };
}

/**
 * Returns all pending sync queue items with their record data.
 */
export async function getQueueItems(): Promise<SyncQueueItem[]> {
  const db = getDatabase();
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue
     WHERE status IN ('pending', 'in_progress')
     ORDER BY id ASC`
  );
}

/**
 * Returns all failed sync queue items (retry_count >= 5).
 */
export async function getFailedItems(): Promise<SyncQueueItem[]> {
  const db = getDatabase();
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY id ASC`
  );
}

/**
 * Resets a failed queue item back to pending so it can be retried.
 */
export async function retryFailedItem(queueId: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'pending', retry_count = 0, last_attempt = NULL
     WHERE id = ?`,
    [queueId]
  );
}

/**
 * Updates a sync queue item's status and retry count.
 * Used internally by the sync worker.
 */
export async function updateQueueItemStatus(
  queueId: number,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  retryCount?: number
): Promise<void> {
  const db = getDatabase();
  const lastAttempt = new Date().toISOString();

  if (retryCount !== undefined) {
    await db.runAsync(
      `UPDATE sync_queue SET status = ?, retry_count = ?, last_attempt = ?
       WHERE id = ?`,
      [status, retryCount, lastAttempt, queueId]
    );
  } else {
    await db.runAsync(
      `UPDATE sync_queue SET status = ?, last_attempt = ? WHERE id = ?`,
      [status, lastAttempt, queueId]
    );
  }
}
