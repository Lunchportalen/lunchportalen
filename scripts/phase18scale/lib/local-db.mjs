/**
 * Fail-closed Phase 18 Postgres target resolver.
 * Never falls back to ambient DATABASE_URL from .env.local.
 *
 * Cloud load-cert (PHASE18_LOADCERT=1) requires Supavisor session pooler (IPv4).
 * Direct db.<ref>.supabase.co is rejected (IPv6-only from GitHub-hosted runners).
 *
 * TLS: keep rejectUnauthorized=true and trust the vendored Supabase Root 2021 CA.
 * Strip sslmode from the connection string before passing to node-postgres so the
 * ssl object (including ca) is not overwritten by pg-connection-string.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROD_REF, STAGING_REF } from "../load-env.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_PORT = 54322;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_CA_BUNDLE = path.resolve(
  __dirname,
  "../certs/supabase-pooler-ca-bundle.crt",
);

function loadSupabaseCaBundle() {
  if (!fs.existsSync(SUPABASE_CA_BUNDLE)) {
    throw new Error(`PHASE18_SUPABASE_CA_MISSING: ${SUPABASE_CA_BUNDLE}`);
  }
  const ca = fs.readFileSync(SUPABASE_CA_BUNDLE, "utf8");
  if (!ca.includes("BEGIN CERTIFICATE")) {
    throw new Error("PHASE18_SUPABASE_CA_INVALID");
  }
  return ca;
}

function connectionStringWithoutSslMode(url) {
  const parsed = parseDbUrl(url);
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("sslrootcert");
  parsed.searchParams.delete("sslcert");
  parsed.searchParams.delete("sslkey");
  return parsed.toString();
}

function cloudSslOptions() {
  return {
    rejectUnauthorized: true,
    ca: loadSupabaseCaBundle(),
    minVersion: "TLSv1.2",
  };
}

export function redactIdentity(parsed, classification, source, extra = {}) {
  return {
    host: parsed.hostname,
    port: parsed.port || (parsed.protocol === "postgresql:" ? "5432" : ""),
    database: (parsed.pathname || "/").replace(/^\//, "") || "postgres",
    username: String(decodeURIComponent(parsed.username || "")).replace(/:.*/, ""),
    classification,
    source,
    ...extra,
  };
}

export function parseDbUrl(url) {
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
    { hostname: host, port: String(port), pathname: `/${db}`, protocol: "postgresql:", username: parsed.username },
    "local",
    source,
  );
  return { connectionString: normalized, identity, ssl: false };
}

/**
 * Isolated cloud Postgres via Supavisor session pooler only.
 * Rejects direct IPv6 db.<ref>.supabase.co and any prod/staging/local target.
 */
export function assertIsolatedCloudPostgresUrl(url, source) {
  const ref = String(process.env.PHASE18_LOAD_REF || "").trim();
  if (!ref) throw new Error("PHASE18_LOAD_REF_REQUIRED_FOR_CLOUD_DB");
  if (ref === PROD_REF || ref === STAGING_REF) {
    throw new Error("PRODUCTION_OR_STAGING_CLOUD_DB_FORBIDDEN");
  }
  const loadCert = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_LOADCERT || "").toLowerCase(),
  );
  if (!loadCert) throw new Error("PHASE18_LOADCERT_REQUIRED_FOR_CLOUD_DB");

  const parsed = parseDbUrl(url);
  const host = String(parsed.hostname || "").toLowerCase();
  const user = String(decodeURIComponent(parsed.username || ""));
  const db = (parsed.pathname || "/postgres").replace(/^\//, "") || "postgres";
  const port = String(parsed.port || "5432");
  const raw = String(url);

  if (raw.includes(PROD_REF) || host.includes(PROD_REF) || user.includes(PROD_REF)) {
    throw new Error("PRODUCTION_OR_STAGING_CLOUD_DB_FORBIDDEN");
  }
  if (raw.includes(STAGING_REF) || host.includes(STAGING_REF) || user.includes(STAGING_REF)) {
    throw new Error("PRODUCTION_OR_STAGING_CLOUD_DB_FORBIDDEN");
  }
  if (LOCAL_HOSTS.has(host) || host === "0.0.0.0" || /localhost/i.test(host)) {
    throw new Error("PHASE18_CLOUD_DB_LOCALHOST_FORBIDDEN");
  }
  if (host === `db.${ref}.supabase.co` || /^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) {
    throw new Error(
      "PHASE18_CLOUD_DB_DIRECT_IPV6_FORBIDDEN: use Supavisor session pooler (aws-0-<region>.pooler.supabase.com:5432)",
    );
  }
  if (!host.includes("pooler.supabase.com")) {
    throw new Error(`PHASE18_CLOUD_DB_HOST_FORBIDDEN: ${host}`);
  }
  if (!/^aws-0-[a-z0-9-]+\.pooler\.supabase\.com$/i.test(host) && !/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/i.test(host)) {
    throw new Error(`PHASE18_CLOUD_DB_POOLER_HOST_FORBIDDEN: ${host}`);
  }
  if (user !== `postgres.${ref}`) {
    throw new Error(`PHASE18_CLOUD_DB_USER_FORBIDDEN: expected postgres.${ref}`);
  }
  if (db !== "postgres") {
    throw new Error(`PHASE18_CLOUD_DB_NAME_FORBIDDEN: ${db}`);
  }
  if (port !== "5432" && port !== "6543") {
    throw new Error(`PHASE18_CLOUD_DB_PORT_FORBIDDEN: ${port}`);
  }

  // Keep sslmode=require on the stored URL for operators/psql; node-pg clients must
  // strip it via createPhase18PgClient so ssl.ca is honored.
  parsed.searchParams.set("sslmode", "require");
  const identity = redactIdentity(
    {
      hostname: host,
      port,
      pathname: `/${db}`,
      protocol: "postgresql:",
      username: user,
    },
    "isolated_cloud",
    source,
    {
      connection_method: "supavisor_session_pooler_ipv4",
      project_ref: ref,
      tls: "rejectUnauthorized=true,ca=supabase-pooler-ca-bundle.crt",
    },
  );
  return {
    connectionString: parsed.toString(),
    identity,
    ssl: cloudSslOptions(),
  };
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
 * Resolve Phase 18 DB target.
 * Priority: PHASE18_DATABASE_URL → SUPABASE_LOCAL_DB_URL → supabase status → fail closed.
 * Explicitly ignores DATABASE_URL / SUPABASE_POSTGRES_URL from ambient .env.local.
 */
export function resolvePhase18DatabaseUrl(opts = {}) {
  const print = opts.print !== false;
  const loadCert = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_LOADCERT || "").toLowerCase(),
  );
  const candidates = [
    ["PHASE18_DATABASE_URL", process.env.PHASE18_DATABASE_URL],
    ["SUPABASE_LOCAL_DB_URL", process.env.SUPABASE_LOCAL_DB_URL],
  ];

  let resolved = null;
  for (const [source, value] of candidates) {
    if (!value || !String(value).trim()) continue;
    const raw = String(value).trim();
    if (loadCert) {
      resolved = assertIsolatedCloudPostgresUrl(raw, source);
    } else {
      resolved = assertLocalPostgresUrl(raw, source);
    }
    break;
  }
  if (!resolved) {
    if (loadCert) {
      throw new Error("PHASE18_CLOUD_DB_URL_REQUIRED");
    }
    resolved = fromSupabaseStatus();
  }

  // Publish for child processes — never publish ambient prod/staging DATABASE_URL.
  process.env.PHASE18_DATABASE_URL = resolved.connectionString;
  if (resolved.identity.classification === "local") {
    process.env.SUPABASE_LOCAL_DB_URL = resolved.connectionString;
  }
  if (process.env.DATABASE_URL) {
    const ambient = process.env.DATABASE_URL;
    if (
      ambient.includes(PROD_REF) ||
      ambient.includes(STAGING_REF) ||
      (resolved.identity.classification === "local" && !/127\.0\.0\.1|localhost/i.test(ambient))
    ) {
      delete process.env.DATABASE_URL;
    }
  }
  if (
    process.env.SUPABASE_POSTGRES_URL &&
    (process.env.SUPABASE_POSTGRES_URL.includes(PROD_REF) ||
      process.env.SUPABASE_POSTGRES_URL.includes(STAGING_REF))
  ) {
    delete process.env.SUPABASE_POSTGRES_URL;
  }

  if (print) {
    console.log(JSON.stringify({ phase18_db_target: resolved.identity }));
  }
  return resolved;
}

export function createPhase18PgClient(pg, opts = {}) {
  const { connectionString, ssl, identity } = resolvePhase18DatabaseUrl({
    print: opts.print !== false,
  });
  const useSsl = ssl === false ? false : ssl || cloudSslOptions();
  const client = new pg.Client({
    // Strip sslmode so node-postgres does not discard the verified ssl.ca object.
    connectionString:
      useSsl === false ? connectionString : connectionStringWithoutSslMode(connectionString),
    ssl: useSsl,
    connectionTimeoutMillis: opts.connectionTimeoutMillis ?? 15000,
  });
  return { client, identity, ssl: useSsl };
}
