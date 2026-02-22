// ─────────────────────────────────────────────────────────────
// Snap & Sync — Background Sync Worker
// ─────────────────────────────────────────────────────────────
//
// Listens for network state changes and automatically triggers
// syncAllPending() when connectivity is restored.
//
// Key design:
//   • Debounced (3s) — prevents "flutter" when phone is on
//     the edge of a Wi-Fi zone
//   • Mutex lock (_isSyncing) — prevents duplicate concurrent runs
//   • Also runs on app launch if already online
//
// Call startSyncWorker() in the root _layout.tsx useEffect.
// ─────────────────────────────────────────────────────────────

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { syncAllPending } from './cloudSync';
import { getQueueStats } from './offlineQueue';
import { useSyncStore } from '@/stores/useSyncStore';

const DEBOUNCE_MS = 3000;    // 3 seconds debounce
let _unsubscribe: (() => void) | null = null;
let _isSyncing = false;       // mutex lock
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _wasOnline = false;        // track previous state for edge detection

/**
 * Attempts to sync all pending items.
 * Guarded by a mutex to prevent concurrent runs.
 */
async function attemptSync(): Promise<void> {
  if (_isSyncing) {
    console.log('[backgroundSync] Already syncing, skipping');
    return;
  }

  // Check if there's anything to sync
  const stats = await getQueueStats();
  if (stats.pendingCount === 0) {
    console.log('[backgroundSync] Queue empty, nothing to sync');
    return;
  }

  _isSyncing = true;
  console.log(`[backgroundSync] Starting sync of ${stats.pendingCount} items`);

  try {
    const result = await syncAllPending();
    console.log(
      `[backgroundSync] Sync complete: ${result.synced} synced, ${result.failed} failed`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[backgroundSync] Sync error:', msg);
    useSyncStore.getState().setLastError(msg);
  } finally {
    _isSyncing = false;

    // Refresh the pending count after sync
    try {
      const updatedStats = await getQueueStats();
      useSyncStore.getState().setPendingCount(updatedStats.pendingCount);
    } catch {
      // Non-critical — UI will catch up on next render
    }
  }
}

/**
 * Debounced sync trigger.
 * Waits DEBOUNCE_MS after the last connectivity change before syncing.
 * This prevents rapid fire/stop cycles on flaky connections.
 */
function debouncedSync(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    attemptSync();
  }, DEBOUNCE_MS);
}

/**
 * Handles network state changes.
 * Only triggers sync when transitioning from offline to online.
 */
function onNetworkChange(state: NetInfoState): void {
  const isOnline = !!(state.isConnected && state.isInternetReachable);

  if (isOnline && !_wasOnline) {
    // Transition: offline → online
    console.log('[backgroundSync] Network restored — scheduling sync');
    debouncedSync();
  }

  _wasOnline = isOnline;
}

/**
 * Starts the background sync worker.
 * Call once in the root _layout.tsx useEffect.
 *
 * - Subscribes to NetInfo for connectivity changes
 * - If already online at launch, triggers an immediate sync
 *
 * @returns Cleanup function (call on unmount)
 */
export function startSyncWorker(): () => void {
  if (_unsubscribe) {
    console.warn('[backgroundSync] Worker already running');
    return stopSyncWorker;
  }

  console.log('[backgroundSync] Starting sync worker');

  // Subscribe to network changes
  _unsubscribe = NetInfo.addEventListener(onNetworkChange);

  // Check initial state — if already online, sync on launch
  NetInfo.fetch().then((state: NetInfoState) => {
    const isOnline = !!(state.isConnected && state.isInternetReachable);
    _wasOnline = isOnline;

    if (isOnline) {
      console.log('[backgroundSync] Already online at launch — scheduling sync');
      debouncedSync();
    }
  });

  return stopSyncWorker;
}

/**
 * Stops the background sync worker and cleans up.
 */
export function stopSyncWorker(): void {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }

  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  _wasOnline = false;
  console.log('[backgroundSync] Worker stopped');
}
