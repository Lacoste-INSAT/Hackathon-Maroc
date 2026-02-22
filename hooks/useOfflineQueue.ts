// ─────────────────────────────────────────────────────────────
// Snap & Sync — useOfflineQueue Hook
// ─────────────────────────────────────────────────────────────
//
// React hook for components to enqueue photos and read queue state.
// Bridges the offlineQueue service with Zustand for reactive UI updates.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect } from 'react';
import { enqueuePhoto, getQueueStats } from '@/services/offlineQueue';
import { useSyncStore } from '@/stores/useSyncStore';

export function useOfflineQueue() {
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const setPendingCount = useSyncStore((s) => s.setPendingCount);
  const incrementPending = useSyncStore((s) => s.incrementPending);

  /**
   * Refresh the pending count from SQLite.
   * Call this after app launch or after sync completion.
   */
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getQueueStats();
      setPendingCount(stats.pendingCount);
    } catch (error) {
      console.error('[useOfflineQueue] Failed to refresh stats:', error);
    }
  }, [setPendingCount]);

  // Load initial count on mount
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  /**
   * Enqueue a captured photo for background sync.
   *
   * @param sessionId    – Active session UUID
   * @param originalUri  – Full-res photo on device
   * @param compressedUri – 150-200KB version (optional)
   * @returns Record ID (UUID)
   */
  const enqueue = useCallback(
    async (
      sessionId: string,
      originalUri: string,
      compressedUri?: string | null
    ): Promise<string> => {
      const recordId = await enqueuePhoto(sessionId, originalUri, compressedUri);

      // Optimistically update the Zustand counter
      incrementPending();

      return recordId;
    },
    [incrementPending]
  );

  return {
    /** Enqueue a photo for sync */
    enqueue,

    /** Number of items pending in the queue */
    queueCount: pendingCount,

    /** Whether the sync worker is currently running */
    isProcessing: syncStatus === 'syncing',

    /** Refresh the pending count from the database */
    refreshStats,
  };
}
