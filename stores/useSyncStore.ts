// ─────────────────────────────────────────────────────────────
// Snap & Sync — Zustand Sync Store
// ─────────────────────────────────────────────────────────────
//
// Global state for sync engine status. Any component can read
// pendingCount/syncStatus without prop drilling.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { SyncStatus } from '@/lib/types';

interface SyncState {
  /** Number of items waiting in the sync queue */
  pendingCount: number;

  /** Current sync engine status */
  syncStatus: SyncStatus;

  /** ISO timestamp of the last successful sync */
  lastSyncAt: string | null;

  /** Last error message, if any */
  lastError: string | null;

  // ── Actions ─────────────────────────────────────────────
  setPendingCount: (count: number) => void;
  incrementPending: () => void;
  decrementPending: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (timestamp: string) => void;
  setLastError: (error: string | null) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  // ── Initial State ─────────────────────────────────────────
  pendingCount: 0,
  syncStatus: 'idle',
  lastSyncAt: null,
  lastError: null,

  // ── Actions ───────────────────────────────────────────────
  setPendingCount: (count) =>
    set({ pendingCount: count }),

  incrementPending: () =>
    set((state) => ({ pendingCount: state.pendingCount + 1 })),

  decrementPending: () =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),

  setSyncStatus: (status) =>
    set({ syncStatus: status }),

  setLastSyncAt: (timestamp) =>
    set({ lastSyncAt: timestamp }),

  setLastError: (error) =>
    set({ lastError: error, syncStatus: error ? 'error' : 'idle' }),

  reset: () =>
    set({
      pendingCount: 0,
      syncStatus: 'idle',
      lastSyncAt: null,
      lastError: null,
    }),
}));
