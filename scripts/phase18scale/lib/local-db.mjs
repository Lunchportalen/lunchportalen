/**
 * Fail-closed Phase 18 Postgres target resolver.
 * Never falls back to ambient DATABASE_URL from .env.local.
 */
import { execFileSync } from "node:child_process";
import { PROD_REF, STAGING_REF } from "../load-env.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_PORT = 54322;

function redactIdentity(parsed, classification, source) {
  return {
    host: parsed.hostname,
    port: parsed.port || (parsed.protocol === "postgresql:" ? "5432" : ""),
    database: (parsed.pathname || "/").replace(/^\//, "") || "postgres",
    classification,
    source,
  };
}

function parseDbUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("PHASE18_DB_URL_INVALID");
  }
  if (!/^postgres(ql)?:$/i.test(u.protocol)) {
    throw new Error(`PHASE18_DB_PROTOCOL_FORBIDDEN: ${u.protocol}`);
  }
  return u;
}

function rejectRemoteRefs(url) {
  const s = String(url);
  if (s.includes(PROD_REF)) throw new Error("PRODUCTION_DB_TARGET_FORBIDDEN");
  if (s.includes(STAGING_REF)) throw new Error("STAGING_DB_TARGET_FORBIDDEN");
  if (/supabase\.co|pooler\.supabase|aws\.com|neon\.tech/i.test(s)) {
    throw new Error("REMOTE_DB_HOST_FORBIDDEN");
  }
}

function assertLocalPostgresUrl(url, source) {
  rejectRemoteRefs(url);
  const parsed = parseDbUrl(url);
  const host = String(parsed.hostname || "").toLowerCase();
  const port = Number(parsed.port || 5432);
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`PHASE18_DB_HOST_NOT_LOCAL: ${host}`);
  }
  if (port !== LOCAL_PORT) {
    throw new Error(`PHASE18_DB_PORT_NOT_LOCAL: ${port} (required ${LOCAL_PORT})`);
  }
  const db = (parsed.pathname || "/postgres").replace(/^\//, "") || "postgres";
  // Local Supabase Postgres is plaintext on the host port — disable TLS explicitly.
  // Do NOT weaken TLS for remote hosts (those are rejected above).
  parsed.searchParams.set("sslmode", "disable");
  const normalized = parsed.toString();
  const identity = redactIdentity(
    { hostname: host, port: String(port), pathname: `/${db}`, protocol: "postgresql:" },
    "local",
    source,
  );
  return { connectionString: normalized, identity, ssl: false };
}

function sh(command) {
  return execFileSync(command, {
    encoding: "utf8",
    timeout: 60000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

function fromSupabaseStatus() {
  let lastErr = null;
  for (const command of [
    "npx supabase status -o env",
    "supabase status -o env",
  ]) {
    try {
      const out = sh(command);
      const m = out.match(/^DB_URL=(.+)$/m);
      if (!m) {
        lastErr = new Error("PHASE18_SUPABASE_STATUS_NO_DB_URL");
        continue;
      }
      let raw = m[1].trim();
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1);
      }
      return assertLocalPostgresUrl(raw, "supabase_status");
    } catch (e) {
      lastErr = e;
    }
  }
  // Verified local docker path (fail-closed if container unhealthy).
  try {
    const healthy = sh(
      'docker inspect -f "{{.State.Health.Status}}" supabase_db_lunchportalen',
    ).trim();
    if (healthy !== "healthy" && healthy !== "starting") {
      throw new Error(`PHASE18_DOCKER_DB_NOT_HEALTHY: ${healthy}`);
    }
    const probe = sh(
      'docker exec supabase_db_lunchportalen psql -U postgres -d postgres -t -A -c "select 1"',
    ).trim();
    if (probe !== "1") throw new Error("PHASE18_DOCKER_DB_PROBE_FAILED");
    return assertLocalPostgresUrl(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "docker_supabase_db_lunchportalen_verified",
    );
  } catch (e) {
    const detail = e?.message || lastErr?.message || lastErr || e;
    throw new Error(`PHASE18_LOCAL_DB_RESOLVE_FAILED: ${detail}`);
  }
}

/**
 * Resolve local Phase 18 DB target.
 * Priority: PHASE18_DATABASE_URL → SUPABASE_LOCAL_DB_URL → supabase status → fail closed.
 * Explicitly ignores DATABASE_URL / SUPABASE_POSTGRES_URL from ambient .env.local.
 */
export function resolvePhase18DatabaseUrl(opts = {}) {
  const print = opts.print !== false;
  const candidates = [
    ["PHASE18_DATABASE_URL", process.env.PHASE18_DATABASE_URL],
    ["SUPABASE_LOCAL_DB_URL", process.env.SUPABASE_LOCAL_DB_URL],
  ];

  let resolved = null;
  for (const [source, value] of candidates) {
    if (!value || !String(value).trim()) continue;
    resolved = assertLocalPostgresUrl(String(value).trim(), source);
    break;
  }
  if (!resolved) {
    resolved = fromSupabaseStatus();
  }

  // Publish for child processes — never publish remote DATABASE_URL.
  process.env.PHASE18_DATABASE_URL = resolved.connectionString;
  process.env.SUPABASE_LOCAL_DB_URL = resolved.connectionString;
  // Neutralize ambient remote URLs for this process tree.
  if (process.env.DATABASE_URL && !/127\.0\.0\.1|localhost/i.test(process.env.DATABASE_URL)) {
    delete process.env.DATABASE_URL;
  }
  if (
    process.env.SUPABASE_POSTGRES_URL &&
    !/127\.0\.0\.1|localhost/i.test(process.env.SUPABASE_POSTGRES_URL)
  ) {
    delete process.env.SUPABASE_POSTGRES_URL;
  }

  if (print) {
    console.log(JSON.stringify({ phase18_db_target: resolved.identity }));
  }
  return resolved;
}

export function createPhase18PgClient(pg) {
  const { connectionString, ssl, identity } = resolvePhase18DatabaseUrl();
  const client = new pg.Client({
    connectionString,
    ssl: ssl ? undefined : false,
  });
  return { client, identity };
}
