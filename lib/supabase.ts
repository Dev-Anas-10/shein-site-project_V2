import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_PROJECT_REF = 'sxcsgnzkgwctafqxkfdd';
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  `https://${SUPABASE_PROJECT_REF}.supabase.co`;

// Public Anonymous Key (safe for browser; used strictly for Supabase Auth in client components)
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

let _supabaseClient: SupabaseClient | null = null;
let _supabaseAdminClient: SupabaseClient | null = null;

/**
 * Public Supabase client for browser and auth interactions
 * Uses anon key. Never has access to restricted tables once RLS is locked down.
 */
export function getSupabase(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;
  if (!SUPABASE_ANON_KEY) return null;

  try {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabaseClient;
  } catch (err) {
    console.warn('Could not initialize public Supabase client:', err);
    return null;
  }
}

/**
 * Server-Only Supabase Admin client
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for internal database operations.
 * Must NEVER be called or bundled on the browser.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    console.error('[SECURITY VIOLATION] getSupabaseAdmin() cannot be called client-side.');
    return null;
  }

  if (_supabaseAdminClient) return _supabaseAdminClient;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminKey = serviceRoleKey || SUPABASE_ANON_KEY;

  if (!adminKey) {
    console.warn('[Supabase Admin] Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is available.');
    return null;
  }

  if (!serviceRoleKey) {
    console.warn(
      '[Supabase Admin] WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables. ' +
      'Falling back to ANON key. Please add SUPABASE_SERVICE_ROLE_KEY to your environment to retain database access after RLS lockdown.'
    );
  }

  try {
    _supabaseAdminClient = createClient(SUPABASE_URL, adminKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return _supabaseAdminClient;
  } catch (err) {
    console.warn('Could not initialize Supabase admin client:', err);
    return null;
  }
}
