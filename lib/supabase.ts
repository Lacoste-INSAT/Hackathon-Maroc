import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';

// ── Client Init ─────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://qwkkmesvsrrnwqhvvqkx.supabase.co';
// Mobile snippets sometimes use EXPO_PUBLIC_SUPABASE_KEY instead of ANON_KEY
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_9sKtFpzvcWQ5EEYaKMqkCQ_1c1HJZ20';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. ' +
    'Set these in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not needed on mobile
    lock: processLock,
  },
  global: {
    // Intercept native fetch to prevent catastrophic console.error loops 
    // when the Supabase URL is dead/unreachable (Network request failed).
    fetch: async (url, options) => {
      try {
        return await fetch(url, options);
      } catch (error) {
        // Return a mock 503 Service Unavailable instead of throwing a raw TypeError
        // This prevents gotrue-js from dumping red stack traces to the Metro console.
        return new Response(JSON.stringify({ error: 'Network request failed (Intercepted)' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
  },
});
