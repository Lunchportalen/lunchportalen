import "server-only";

/**
 * Centralised, typed access to critical platform env vars.
 *
 * Scope:
 * - Supabase URL / publishable (anon) key (public + server)
 * - Sanity project / dataset / API version (read + write)
 *
 * Supabase service role: NOT exposed here — use `supabaseAdmin()` from `@/lib/supabase/admin` only.
 *
 * Design:
 * - Required vars: mustEnv() throws on missing (no silent fallback). Callers fail fast.
 * - In test/Vitest, allows explicit test defaults only where documented (Supabase public).
 * - Does NOT log secrets or echo values – only variable names.
 */

function isTestEnv() {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

type MustEnvOptions = {
  /**
   * Optional default used ONLY in test environments.
   * In non-test environments, a missing value always throws.
   */
  testDefault?: string;
};

function mustEnv(name: string, opts: MustEnvOptions = {}): string {
  const raw = process.env[name];
  const v = safeTrim(raw);
  if (v) return v;

  if (isTestEnv() && opts.testDefault !== undefined) {
    return opts.testDefault;
  }

  throw new Error(`Missing env: ${name}`);
}

/* =========================================================
   Supabase
========================================================= */

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

const TEST_SUPABASE_URL = "http://supabase.test";
const TEST_SUPABASE_PUBLISHABLE_KEY = "anon_test_key";

function readSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const v = safeTrim(key);
  if (v) return v;
  if (isTestEnv()) return TEST_SUPABASE_PUBLISHABLE_KEY;
  throw new Error(
    "Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  );
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return {
    url: mustEnv("NEXT_PUBLIC_SUPABASE_URL", { testDefault: TEST_SUPABASE_URL }),
    anonKey: readSupabasePublishableKey(),
  };
}

/* =========================================================
   Sanity
========================================================= */

export type SanityReadConfig = {
  projectId: string;
  dataset: string;
  apiVersion: string;
};

export function getSanityReadConfig(): SanityReadConfig {
  const projectId = mustEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const dataset = mustEnv("NEXT_PUBLIC_SANITY_DATASET");
  const apiVersion = safeTrim(process.env.NEXT_PUBLIC_SANITY_API_VERSION) || "2024-01-01";

  return {
    projectId,
    dataset,
    apiVersion,
  };
}

/**
 * Returns the Sanity write token if configured; otherwise null.
 * Use requireSanityWriteToken() if the caller truly requires write access.
 */
export function getSanityWriteToken(): string | null {
  const raw = safeTrim(process.env.SANITY_WRITE_TOKEN);
  return raw || null;
}

export function requireSanityWriteToken(): string {
  const token = getSanityWriteToken();
  if (!token) {
    throw new Error("Missing env: SANITY_WRITE_TOKEN");
  }
  return token;
}

