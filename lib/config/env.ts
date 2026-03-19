import "server-only";

/**
 * Centralised, typed access to critical platform env vars.
 *
 * Scope:
 * - Supabase URL / anon key (public + server)
 * - Supabase service role key (admin client)
 * - Sanity project / dataset / API version (read + write)
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

export type SupabaseAdminConfig = {
  /**
   * Server-side Supabase URL.
   * Prefer SUPABASE_URL when present, otherwise NEXT_PUBLIC_SUPABASE_URL.
   */
  url: string;
  serviceRoleKey: string;
};

const TEST_SUPABASE_URL = "http://supabase.test";
const TEST_SUPABASE_ANON_KEY = "anon_test_key";

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return {
    url: mustEnv("NEXT_PUBLIC_SUPABASE_URL", { testDefault: TEST_SUPABASE_URL }),
    anonKey: mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", { testDefault: TEST_SUPABASE_ANON_KEY }),
  };
}

export function getSupabaseAdminConfig(): SupabaseAdminConfig {
  const explicitServerUrl = safeTrim(process.env.SUPABASE_URL);
  const fallbackUrl = explicitServerUrl || mustEnv("NEXT_PUBLIC_SUPABASE_URL", { testDefault: TEST_SUPABASE_URL });

  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url: fallbackUrl,
    serviceRoleKey,
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

