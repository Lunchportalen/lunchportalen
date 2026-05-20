const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);

/** Staging branch ref — integration tests must never target prod. */
export const STAGING_SUPABASE_REF = "uigxsboqeruxflgzqztl";
const PROD_SUPABASE_REF = "hkpokyapzarefrgqzkos";

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

function assertStagingSupabaseUrl(url: string): void {
  if (url.includes(PROD_SUPABASE_REF)) {
    throw new Error(
      `REFUSE_PROD_SUPABASE_URL: integration tests must use staging (${STAGING_SUPABASE_REF}), not prod (${PROD_SUPABASE_REF})`,
    );
  }
  if (!url.includes(STAGING_SUPABASE_REF)) {
    throw new Error(
      `REFUSE_NON_STAGING_SUPABASE_URL: expected ref ${STAGING_SUPABASE_REF} in NEXT_PUBLIC_SUPABASE_URL`,
    );
  }
}

export function hasRemoteSupabaseIntegrationEnv(options?: { requireAnon?: boolean; requirePostgres?: boolean }): boolean {
  if (!remoteSupabaseIntegrationEnabled()) return false;
  const url = safe(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
  const serviceKey = safe(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = safe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !serviceKey) return false;
  if (options?.requireAnon === true && !anonKey) return false;
  try {
    assertStagingSupabaseUrl(url);
  } catch {
    return false;
  }
  if (options?.requirePostgres === true) {
    try {
      readPostgresFixtureEnv();
    } catch {
      return false;
    }
  }
  return true;
}

/** Postgres URL for fixture DML (postgres role). Required for provider integration tests on staging. */
export function readPostgresFixtureEnv(): { connectionString: string } {
  const connectionString = safe(
    process.env.SUPABASE_POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      "",
  );
  if (!connectionString) {
    throw new Error(
      "Missing postgres fixture env: set SUPABASE_POSTGRES_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL (staging branch)",
    );
  }
  if (connectionString.includes(PROD_SUPABASE_REF)) {
    throw new Error(`REFUSE_PROD_POSTGRES_URL: fixture DML must use staging (${STAGING_SUPABASE_REF})`);
  }
  if (!connectionString.includes(STAGING_SUPABASE_REF)) {
    throw new Error(`REFUSE_NON_STAGING_POSTGRES_URL: expected ref ${STAGING_SUPABASE_REF}`);
  }
  return { connectionString };
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
  assertStagingSupabaseUrl(url);
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
