/**
 * Client-safe access to public Supabase env only.
 * Do NOT import this from server-only modules; use lib/config/env.ts there.
 * Used by lib/supabase/client.ts (browser Supabase client).
 */

import {
  LOCAL_CMS_RUNTIME_SUPABASE_ANON_KEY,
  LOCAL_CMS_RUNTIME_SUPABASE_URL,
  getCmsRuntimeStatus,
} from "@/lib/localRuntime/runtime";

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export type SupabasePublicConfigStatus =
  | {
      ok: true;
      url: string;
      anonKey: string;
      issue: null;
      message: null;
    }
  | {
      ok: false;
      url: null;
      anonKey: null;
      issue: "missing_url" | "missing_anon_key" | "invalid_url";
      message: string;
    };

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const TEST_SUPABASE_URL = "http://supabase.test";
const TEST_SUPABASE_PUBLISHABLE_KEY = "anon_test_key";

function readPublishableKeyRaw(): string {
  return safeTrim(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function localRuntimeConfigStatus(): SupabasePublicConfigStatus {
  return {
    ok: true,
    url: LOCAL_CMS_RUNTIME_SUPABASE_URL,
    anonKey: LOCAL_CMS_RUNTIME_SUPABASE_ANON_KEY,
    issue: null,
    message: null,
  };
}

/**
 * Returns public Supabase URL and anon key. Safe to call from client bundle.
 * Throws if required vars are missing (except in test env where defaults apply).
 */
export function getSupabasePublicConfigStatus(): SupabasePublicConfigStatus {
  let url = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let anonKey = readPublishableKeyRaw();
  const cmsRuntime = getCmsRuntimeStatus();

  if (isTestEnv()) {
    url = url || TEST_SUPABASE_URL;
    anonKey = anonKey || TEST_SUPABASE_PUBLISHABLE_KEY;
  }

  if (!url) {
    if (cmsRuntime.mode === "local_provider") {
      return localRuntimeConfigStatus();
    }
    return {
      ok: false,
      url: null,
      anonKey: null,
      issue: "missing_url",
      message: "Innlogging er ikke konfigurert fordi Supabase-URL mangler i dette miljøet.",
    };
  }

  if (!isValidSupabaseUrl(url)) {
    if (cmsRuntime.mode === "local_provider") {
      return localRuntimeConfigStatus();
    }
    return {
      ok: false,
      url: null,
      anonKey: null,
      issue: "invalid_url",
      message: "Innlogging er ikke konfigurert fordi Supabase-URL er ugyldig i dette miljøet.",
    };
  }

  if (!anonKey) {
    if (cmsRuntime.mode === "local_provider") {
      return localRuntimeConfigStatus();
    }
    return {
      ok: false,
      url: null,
      anonKey: null,
      issue: "missing_anon_key",
      message: "Innlogging er ikke konfigurert fordi Supabase anon-nøkkel mangler i dette miljøet.",
    };
  }

  return {
    ok: true,
    url,
    anonKey,
    issue: null,
    message: null,
  };
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const status = getSupabasePublicConfigStatus();
  if (status.ok) {
    return {
      url: status.url,
      anonKey: status.anonKey,
    };
  }

  if (status.issue === "missing_url") throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (status.issue === "missing_anon_key") {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  throw new Error("Invalid env: NEXT_PUBLIC_SUPABASE_URL");
}
