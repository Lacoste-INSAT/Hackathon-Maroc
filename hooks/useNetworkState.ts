// ─────────────────────────────────────────────────────────────
// Snap & Sync — Network State Hook
// ─────────────────────────────────────────────────────────────
//
// Wraps @react-native-community/netinfo to provide a simple
// { isOnline, connectionType } state that updates in real-time.
//
// "Online" means BOTH isConnected AND isInternetReachable are true.
// On rural 3G connections, isConnected can be true while
// isInternetReachable is false — we treat that as offline.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { NetworkState } from '@/lib/types';

export function useNetworkState(): NetworkState {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: true,             // optimistic default
    connectionType: null,
  });

  useEffect(() => {
    const toOnline = (state: NetInfoState): boolean => {
      // Some networks report isInternetReachable as null for a short time.
      // Treat null as reachable if the device is connected, to avoid false offline mode.
      const reachable = state.isInternetReachable ?? true;
      return !!(state.isConnected && reachable);
    };

    // Fetch the current state immediately on mount
    NetInfo.fetch().then((state: NetInfoState) => {
      setNetworkState({
        isOnline: toOnline(state),
        connectionType: state.type ?? null,
      });
    });

    // Subscribe to real-time changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState({
        isOnline: toOnline(state),
        connectionType: state.type ?? null,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return networkState;
}
