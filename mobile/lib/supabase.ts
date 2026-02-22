// ─────────────────────────────────────────────────────────────
// Snap & Sync — Supabase Client
// ─────────────────────────────────────────────────────────────
//
// Initializes the Supabase client with an expo-secure-store
// adapter for persistent auth sessions.
//
// Set your credentials via environment variables:
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ── SecureStore Adapter ─────────────────────────────────────
// Supabase stores auth tokens in localStorage by default.
// On mobile, we use expo-secure-store for encrypted storage.

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      console.warn('[supabase] SecureStore.getItemAsync failed for key:', key);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      console.warn('[supabase] SecureStore.setItemAsync failed for key:', key);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      console.warn('[supabase] SecureStore.deleteItemAsync failed for key:', key);
    }
  },
};

// ── Client Init ─────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set these in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not needed on mobile
  },
});
