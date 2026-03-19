/**
 * Client-safe access to public Supabase env only.
 * Do NOT import this from server-only modules; use lib/config/env.ts there.
 * Used by lib/supabase/client.ts (browser Supabase client).
 */

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

const TEST_SUPABASE_URL = "http://supabase.test";
const TEST_SUPABASE_ANON_KEY = "anon_test_key";

/**
 * Returns public Supabase URL and anon key. Safe to call from client bundle.
 * Throws if required vars are missing (except in test env where defaults apply).
 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (url && anonKey) {
    return { url, anonKey };
  }

  if (isTestEnv()) {
    return {
      url: url || TEST_SUPABASE_URL,
      anonKey: anonKey || TEST_SUPABASE_ANON_KEY,
    };
  }

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
