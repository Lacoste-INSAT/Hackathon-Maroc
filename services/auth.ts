// ─────────────────────────────────────────────────────────────
// Snap & Sync — Auth Service
// ─────────────────────────────────────────────────────────────
//
// Wraps Supabase Auth for sign-in, sign-out, and session management.
// ─────────────────────────────────────────────────────────────

import { supabase } from '../mobile/lib/supabase';
// Supabase types will be inferred from the client directly to avoid path resolution errors.
type Session = any;
type User = any;
type AuthChangeEvent = string;

/**
 * Sign in with email and password.
 * Returns the session or throws on error.
 */
export async function signIn(
  email: string,
  password: string
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`[auth] Sign in failed: ${error.message}`);
  }

  if (!data.session) {
    throw new Error('[auth] Sign in returned no session');
  }

  return data.session;
}

/**
 * Sign up a new doctor account.
 * After sign-up, inserts a row into the `doctors` table.
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  clinicId?: string | null
): Promise<Session> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    throw new Error(`[auth] Sign up failed: ${error.message}`);
  }

  if (!data.session || !data.user) {
    throw new Error('[auth] Sign up returned no session');
  }

  // Insert the doctor profile row
  const { error: profileError } = await supabase
    .from('doctors')
    .insert({
      id: data.user.id,
      full_name: fullName,
      clinic_id: clinicId ?? null,
    });

  if (profileError) {
    console.error('[auth] Failed to create doctor profile:', profileError.message);
    // Don't throw — the auth account exists, profile can be retried
  }

  return data.session;
}

/**
 * Sign out the current user. Clears the session from SecureStore.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`[auth] Sign out failed: ${error.message}`);
  }
}

/**
 * Returns the current session, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[auth] getSession error:', error.message);
    return null;
  }
  return data.session;
}

/**
 * Returns the current user, or null if not authenticated.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[auth] getUser error:', error.message);
    return null;
  }
  return data.user;
}

/**
 * Subscribe to auth state changes (sign-in, sign-out, token refresh).
 * Returns an unsubscribe function.
 *
 * @example
 * const unsub = onAuthStateChange((event, session) => {
 *   if (event === 'SIGNED_OUT') router.replace('/login');
 * });
 * // Later: unsub();
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
