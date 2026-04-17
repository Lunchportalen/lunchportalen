const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);

function safe(value: unknown): string {
  return String(value ?? "").trim();
}

function optInFlag(): string {
  return safe(
    process.env.RUN_SUPABASE_INTEGRATION_TESTS ?? process.env.VITEST_SUPABASE_INTEGRATION,
  ).toLowerCase();
}

export function remoteSupabaseIntegrationEnabled(): boolean {
  return ENABLED_VALUES.has(optInFlag());
}

export function hasRemoteSupabaseIntegrationEnv(options?: { requireAnon?: boolean }): boolean {
  if (!remoteSupabaseIntegrationEnabled()) return false;
  const url = safe(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
  const serviceKey = safe(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = safe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !serviceKey) return false;
  if (options?.requireAnon === true && !anonKey) return false;
  return true;
}

export function readRemoteSupabaseIntegrationEnv(options?: { requireAnon?: boolean }) {
  if (!remoteSupabaseIntegrationEnabled()) {
    throw new Error(
      "Remote Supabase integration tests are disabled. Set RUN_SUPABASE_INTEGRATION_TESTS=1 to enable them.",
    );
  }

  const url = safe(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
  const serviceKey = safe(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = safe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }
  if (!serviceKey) {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  }
  if (options?.requireAnon === true && !anonKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    url,
    serviceKey,
    anonKey: anonKey || null,
  };
}
