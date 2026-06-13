/**
 * Edge-safe resolution of public Supabase URL + publishable key.
 * No `server-only` import — safe for middleware and client bundles.
 */

function trimEnv(v: unknown): string {
  return String(v ?? "").trim();
}

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

const TEST_SUPABASE_URL = "http://supabase.test";
const TEST_SUPABASE_PUBLISHABLE_KEY = "anon_test_key";

/**
 * Prefer NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with legacy fallbacks.
 */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let v = trimEnv(key);
  if (!v && isTestEnv()) {
    v = TEST_SUPABASE_PUBLISHABLE_KEY;
  }
  if (!v) {
    throw new Error(
      "Missing Supabase publishable key: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY during migration)"
    );
  }
  return v;
}

export function getSupabaseUrlOrThrow(): string {
  let url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url && isTestEnv()) {
    url = TEST_SUPABASE_URL;
  }
  if (!url) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabasePublicCredentials(): { url: string; anonKey: string } {
  return {
    url: getSupabaseUrlOrThrow(),
    anonKey: getSupabasePublishableKey(),
  };
}
