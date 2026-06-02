#!/usr/bin/env node
/**
 * Fail-closed DB environment target guard.
 *
 * Layer A (authoritative): SELECT value FROM _meta.environment WHERE key = 'name'
 * Layer B (cross-check): parse Supabase project ref from DATABASE_URL; abort if it
 *   contradicts --expect. Unparseable URL → rely on A only.
 *
 * Usage:
 *   node scripts/ci/assert-db-target.mjs --expect staging|production
 *   node scripts/ci/assert-db-target.mjs --expect staging --bootstrap
 *
 * Bootstrap mode (--bootstrap): skip layer A; require parsedRef === PROJECT_REFS[expect].
 *
 * Requires DATABASE_URL (or pass --url).
 */
import { Client } from "pg";
import { fileURLToPath } from "node:url";

/** @typedef {"staging" | "production"} DbEnvironment */

/** @typedef {"proceed" | "abort"} TargetDecision */

/** @typedef {{ decision: TargetDecision, reason: string, sentinel?: string | null, expect?: DbEnvironment, parsedRef?: string | null, refEnv?: DbEnvironment | null }} TargetResult */

export const PROJECT_REFS = {
  staging: "uigxsboqeruxflgzqztl",
  production: "hkpokyapzarefrgqzkos",
};

const SENTINEL_KEY = "name";
const SENTINEL_QUERY = `SELECT value FROM _meta.environment WHERE key = $1 LIMIT 1`;

/**
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
 * @param {string | null | undefined} ref
 * @returns {DbEnvironment | null}
 */
export function environmentFromProjectRef(ref) {
  const normalized = String(ref ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === PROJECT_REFS.staging) return "staging";
  if (normalized === PROJECT_REFS.production) return "production";
  return null;
}

/**
 * Pure evaluation — used by tests and live assert.
 *
 * @param {{ sentinel: string | null | undefined, expect: DbEnvironment, parsedRef?: string | null }} input
 * @returns {TargetResult}
 */
export function evaluateDbTarget(input) {
  const expect = input.expect;
  const sentinel = input.sentinel == null ? null : String(input.sentinel).trim();
  const parsedRef = input.parsedRef == null ? null : String(input.parsedRef).trim().toLowerCase() || null;

  if (expect !== "staging" && expect !== "production") {
    return { decision: "abort", reason: "invalid_expect", expect, sentinel, parsedRef };
  }

  if (!sentinel) {
    return { decision: "abort", reason: "missing_sentinel", expect, sentinel: null, parsedRef };
  }

  if (sentinel !== expect) {
    return {
      decision: "abort",
      reason: "sentinel_mismatch",
      expect,
      sentinel,
      parsedRef,
    };
  }

  if (parsedRef) {
    const refEnv = environmentFromProjectRef(parsedRef);
    if (refEnv && refEnv !== expect) {
      return {
        decision: "abort",
        reason: "ref_contradicts_expect",
        expect,
        sentinel,
        parsedRef,
        refEnv,
      };
    }
  }

  return { decision: "proceed", reason: "ok", expect, sentinel, parsedRef };
}

/**
 * Bootstrap evaluation — layer B only (ref must match label). Sentinel may be absent.
 *
 * @param {{ expect: DbEnvironment, parsedRef?: string | null }} input
 * @returns {TargetResult}
 */
export function evaluateBootstrapTarget(input) {
  const expect = input.expect;
  const parsedRef = input.parsedRef == null ? null : String(input.parsedRef).trim().toLowerCase() || null;

  if (expect !== "staging" && expect !== "production") {
    return { decision: "abort", reason: "invalid_expect", expect, parsedRef };
  }

  const expectedRef = PROJECT_REFS[expect];

  if (!parsedRef) {
    return { decision: "abort", reason: "ref_unparseable", expect, parsedRef: null };
  }

  if (parsedRef !== expectedRef) {
    return {
      decision: "abort",
      reason: "ref_mismatch",
      expect,
      parsedRef,
      refEnv: environmentFromProjectRef(parsedRef),
    };
  }

  return { decision: "proceed", reason: "bootstrap_ok", expect, parsedRef };
}

/**
 * @param {import("pg").Client} client
 * @returns {Promise<string | null>}
 */
export async function readEnvironmentSentinel(client) {
  try {
    const { rows } = await client.query(SENTINEL_QUERY, [SENTINEL_KEY]);
    const value = rows?.[0]?.value;
    return value == null ? null : String(value).trim();
  } catch (err) {
    const code = /** @type {{ code?: string }} */ (err).code;
    if (code === "42P01" || code === "3F000") {
      return null;
    }
    throw err;
  }
}

/**
 * @param {string} connectionString
 */
export function createPgClientConfig(connectionString) {
  let url = connectionString;
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    url = u.toString();
  } catch {
    // keep raw connection string
  }
  return { connectionString: url, ssl: { rejectUnauthorized: false } };
}

/**
 * @param {{ connectionString: string, expect: DbEnvironment, bootstrap?: boolean }} options
 * @returns {Promise<TargetResult>}
 */
export async function assertDbTarget(options) {
  const connectionString = String(options.connectionString ?? "").trim();
  const expect = options.expect;
  const bootstrap = options.bootstrap === true;

  if (!connectionString) {
    return { decision: "abort", reason: "missing_database_url", expect };
  }

  const parsedRef = parseProjectRefFromDatabaseUrl(connectionString);

  if (bootstrap) {
    return evaluateBootstrapTarget({ expect, parsedRef });
  }

  const client = new Client(createPgClientConfig(connectionString));
  await client.connect();

  try {
    const sentinel = await readEnvironmentSentinel(client);
    return evaluateDbTarget({ sentinel, expect, parsedRef });
  } finally {
    await client.end();
  }
}

function parseArgs(argv) {
  /** @type {{ expect?: DbEnvironment, url?: string, bootstrap?: boolean }} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--expect" && argv[i + 1]) {
      out.expect = /** @type {DbEnvironment} */ (argv[++i]);
    } else if (argv[i] === "--url" && argv[i + 1]) {
      out.url = argv[++i];
    } else if (argv[i] === "--bootstrap") {
      out.bootstrap = true;
    }
  }
  return out;
}

function formatResult(result) {
  const parts = [
    `decision=${result.decision}`,
    `reason=${result.reason}`,
    result.expect ? `expect=${result.expect}` : null,
    result.sentinel != null ? `sentinel=${result.sentinel}` : null,
    result.parsedRef != null ? `parsedRef=${result.parsedRef}` : null,
    result.refEnv ? `refEnv=${result.refEnv}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

async function main() {
  const { expect, url, bootstrap } = parseArgs(process.argv.slice(2));
  if (!expect) {
    console.error("::error::assert-db-target: --expect staging|production is required");
    process.exit(1);
  }

  const connectionString = (url ?? process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    console.error("::error::assert-db-target: DATABASE_URL not set (or pass --url)");
    process.exit(1);
  }

  let result;
  try {
    result = await assertDbTarget({ connectionString, expect, bootstrap });
  } catch (err) {
    console.error(`::error::assert-db-target: query failed — ${/** @type {Error} */ (err).message}`);
    process.exit(1);
  }

  const mode = bootstrap ? "bootstrap" : "full";
  console.log(`assert-db-target mode=${mode} ${formatResult(result)}`);

  if (result.decision === "proceed") {
    process.exit(0);
  }

  console.error(`::error::assert-db-target ABORT (${result.reason})`);
  process.exit(1);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error("::error::assert-db-target failed:", err);
    process.exit(1);
  });
}
