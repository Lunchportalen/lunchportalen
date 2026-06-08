/**
 * Delt bygging/normalisering for RLS golden snapshot (v2).
 * Brukes av scripts/rls/snapshot-rls.mjs og tests/rls/migrationParity.test.ts.
 */

/** @type {string} */
export const SQL_POSTGRES_VERSION = "SELECT version() AS postgres_version";

/** Policies i public/private: uttrykk fra pg_get_expr, roller fra pg_roles. */
export const SQL_POLICIES = `
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  p.polname AS name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE p.polcmd::text
  END AS command,
  CASE
    WHEN p.polroles IS NULL OR cardinality(p.polroles) = 0 THEN ARRAY[]::text[]
    ELSE ARRAY(
      SELECT rol.rolname::text
      FROM unnest(p.polroles) AS pr(oid)
      JOIN pg_roles rol ON rol.oid = pr.oid
      ORDER BY rol.rolname
    )
  END AS roles,
  NULLIF(btrim(pg_get_expr(p.polqual, p.polrelid)), '') AS using_expr,
  NULLIF(btrim(pg_get_expr(p.polwithcheck, p.polrelid)), '') AS check_expr,
  p.polpermissive AS permissive_bool
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'private')
`;

export const SQL_PRIVATE_FUNCTIONS = `
SELECT
  p.proname AS name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS is_security_definer,
  p.provolatile::text AS provolatile,
  md5(pg_get_functiondef(p.oid)) AS body_hash
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
`;

export const SQL_RLS_ENABLED_TABLES = `
SELECT
  n.nspname AS schema,
  c.relname AS name,
  (SELECT COUNT(*)::int FROM pg_policy pol WHERE pol.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'private')
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
`;

function cmp(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

function normExpr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function permissiveToBool(permissiveBool) {
  if (typeof permissiveBool === "boolean") return permissiveBool;
  const s = String(permissiveBool ?? "").toUpperCase();
  if (s === "PERMISSIVE" || s === "T" || s === "TRUE") return true;
  if (s === "RESTRICTIVE" || s === "F" || s === "FALSE") return false;
  throw new Error(`Ukjent policy.permissive: ${JSON.stringify(permissiveBool)}`);
}

function sortRoles(roles) {
  if (roles == null) return [];
  const arr = Array.isArray(roles) ? roles.map((r) => String(r)) : [String(roles)];
  arr.sort((a, b) => a.localeCompare(b, "en"));
  return arr;
}

/** @param {string} provolatile - en bokstav fra pg_proc.provolatile (som text) */
export function mapVolatility(provolatile) {
  const c = String(provolatile ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 1);
  if (c === "i") return "immutable";
  if (c === "s") return "stable";
  if (c === "v") return "volatile";
  return "unknown";
}

/**
 * @param {Array<{
 *   schema: string,
 *   table_name: string,
 *   name: string,
 *   command: string,
 *   roles: unknown,
 *   using_expr: unknown,
 *   check_expr: unknown,
 *   permissive_bool: boolean
 * }>} rows
 */
export function normalizePolicies(rows) {
  const out = rows.map((r) => ({
    schema: String(r.schema),
    table: String(r.table_name),
    name: String(r.name),
    command: String(r.command),
    roles: sortRoles(r.roles),
    using_expr: normExpr(r.using_expr),
    check_expr: normExpr(r.check_expr),
    permissive: permissiveToBool(r.permissive_bool),
  }));
  out.sort(
    (a, b) => cmp(a.schema, b.schema) || cmp(a.table, b.table) || cmp(a.name, b.name),
  );
  return out;
}

/**
 * @param {Array<{
 *   name: string,
 *   args: string|null,
 *   result_type: string,
 *   is_security_definer: boolean,
 *   provolatile: string,
 *   body_hash: string
 * }>} rows
 */
export function normalizePrivateFunctions(rows) {
  const out = rows.map((r) => ({
    name: String(r.name),
    args: r.args == null ? "" : String(r.args),
    result_type: String(r.result_type),
    is_security_definer: Boolean(r.is_security_definer),
    volatility: mapVolatility(r.provolatile),
    body_hash: String(r.body_hash).toLowerCase(),
  }));
  out.sort((a, b) => cmp(a.name, b.name));
  return out;
}

/**
 * @param {Array<{ schema: string, name: string, policy_count: number }>} rows
 */
export function normalizeRlsEnabledTables(rows) {
  const out = rows.map((r) => ({
    schema: String(r.schema),
    name: String(r.name),
    policy_count: Number(r.policy_count),
  }));
  out.sort((a, b) => cmp(a.schema, b.schema) || cmp(a.name, b.name));
  return out;
}

/**
 * @param {{
 *   generated_at?: string,
 *   project_ref: string,
 *   postgres_version: string,
 *   policyRows: unknown[],
 *   functionRows: unknown[],
 *   rlsRows: unknown[],
 * }} p
 */
export function buildGoldenPayload(p) {
  const {
    generated_at = new Date().toISOString(),
    project_ref,
    postgres_version,
    policyRows,
    functionRows,
    rlsRows,
  } = p;
  return {
    version: 2,
    generated_at,
    project_ref: String(project_ref),
    postgres_version: String(postgres_version),
    policies: normalizePolicies(policyRows),
    private_functions: normalizePrivateFunctions(functionRows),
    rls_enabled_tables: normalizeRlsEnabledTables(rlsRows),
  };
}

/**
 * Supabase pooler / self-signed chain: krever ofte rejectUnauthorized: false + sslmode=require.
 * @param {string} url
 * @param {number} [max]
 */
export function createSupabasePoolConfig(url, max = 2) {
  let connectionString = url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    connectionString = u.toString();
  } catch {
    // non-URL connection string — bruk som den er
  }
  return {
    connectionString,
    max,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  };
}

/** Pinned prod ref for RLS golden / drift (override via RLS_DRIFT_EXPECTED_REF). */
export const DEFAULT_RLS_DRIFT_EXPECTED_REF = "hkpokyapzarefrgqzkos";

/**
 * @returns {string}
 */
export function resolveExpectedRlsProjectRef() {
  return (process.env.RLS_DRIFT_EXPECTED_REF ?? DEFAULT_RLS_DRIFT_EXPECTED_REF)
    .trim()
    .toLowerCase();
}

/**
 * RLS tooling URL: explicit override, then DATABASE_URL (CI prod), then SUPABASE_POSTGRES_URL.
 * Avoids staging SUPABASE_POSTGRES_URL overriding prod DATABASE_URL in .env.local.
 * @returns {string}
 */
export function resolveRlsDatabaseUrl() {
  const dedicated = (process.env.RLS_DRIFT_DATABASE_URL ?? "").trim();
  if (dedicated) return dedicated;
  const db = (process.env.DATABASE_URL ?? "").trim();
  if (db) return db;
  return (process.env.SUPABASE_POSTGRES_URL ?? "").trim();
}

/**
 * Parse Supabase project ref from pooler/direct Postgres URL.
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function parseProjectRefFromDatabaseUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return null;

  try {
    const normalized = raw.replace(/^postgres(ql)?:\/\//i, "https://");
    const u = new URL(normalized);
    const user = decodeURIComponent(u.username || "");
    const fromUser = user.match(/^postgres\.([a-z0-9]{20})$/i);
    if (fromUser) return fromUser[1].toLowerCase();

    const fromHost = u.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/i);
    if (fromHost) return fromHost[1].toLowerCase();
  } catch {
    return null;
  }

  return null;
}

/**
 * Fail-closed identity guard for RLS drift check and golden snapshot generation.
 * @param {{ databaseUrl: string, goldenProjectRef?: string | null, expectedRef?: string }} input
 * @returns {{ ok: true, connectedRef: string, expectedRef: string } | { ok: false, error: string }}
 */
export function assertRlsDriftDbIdentity(input) {
  const expectedRef = (input.expectedRef ?? resolveExpectedRlsProjectRef()).trim().toLowerCase();
  const connectedRef = parseProjectRefFromDatabaseUrl(input.databaseUrl);

  if (!connectedRef) {
    return { ok: false, error: "Could not verify DB identity for RLS drift check" };
  }

  if (connectedRef !== expectedRef) {
    return {
      ok: false,
      error: `RLS drift target mismatch: expected ${expectedRef}, got ${connectedRef}`,
    };
  }

  if (input.goldenProjectRef != null && input.goldenProjectRef !== "") {
    const goldenRef = String(input.goldenProjectRef).trim().toLowerCase();
    if (goldenRef !== expectedRef) {
      return {
        ok: false,
        error: `golden generated against wrong instance: ${input.goldenProjectRef}`,
      };
    }
  }

  return { ok: true, connectedRef, expectedRef };
}
