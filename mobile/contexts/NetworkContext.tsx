// ─────────────────────────────────────────────────────────────
// Snap & Sync — Network Context Provider
// ─────────────────────────────────────────────────────────────
//
// Wraps the entire app so any component can call useNetwork()
// to get the current connectivity state. Replaces all hardcoded
// isOnline toggles from the v0 mock.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext } from 'react';
import { useNetworkState } from '@/hooks/useNetworkState';
import type { NetworkState } from '@/lib/types';

const NetworkContext = createContext<NetworkState>({
  isOnline: true,
  connectionType: null,
});

/**
 * Provides network state to the entire component tree.
 * Add <NetworkProvider> in the root _layout.tsx.
 */
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const networkState = useNetworkState();

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Hook to consume network state from any component.
 *
 * @example
 * const { isOnline, connectionType } = useNetwork();
 * if (!isOnline) showOfflineWarning();
 */
export function useNetwork(): NetworkState {
  return useContext(NetworkContext);
}
