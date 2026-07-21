#!/usr/bin/env node
/**
 * Fail-closed cloud Postgres connectivity preflight for Phase 18SCALE.
 * Verifies isolated project identity, IPv4-capable pooler DNS, TLS, SELECT 1,
 * migration head, and one synthetic marker — without printing credentials.
 */
import dns from "node:dns/promises";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  assertIsolatedCloudPostgresUrl,
  createPhase18PgClient,
  parseDbUrl,
  resolvePhase18DatabaseUrl,
} from "./lib/local-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase18scale/evidence");
const EXPECTED_REF = "arstaxredytrjcmqcwhh";

function countProductionTargetReferences(url, ref) {
  const hay = `${url}\n${ref}`;
  let n = 0;
  if (hay.includes(PROD_REF)) n += 1;
  if (hay.includes(STAGING_REF)) n += 1;
  if (/127\.0\.0\.1|localhost|0\.0\.0\.0|:54322|:54321/i.test(hay)) n += 1;
  return n;
}

function localMigrationHead() {
  const dir = path.join(ROOT, "supabase/migrations");
  const versions = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .map((f) => f.replace(/_.+$/, ""))
    .sort();
  if (!versions.length) throw new Error("PHASE18_LOCAL_MIGRATIONS_EMPTY");
  return versions[versions.length - 1];
}

async function resolveDns(host) {
  let ipv4 = [];
  let ipv6 = [];
  try {
    ipv4 = await dns.resolve4(host);
  } catch {
    ipv4 = [];
  }
  try {
    ipv6 = await dns.resolve6(host);
  } catch {
    ipv6 = [];
  }
  return { ipv4, ipv6 };
}

async function probeIpv6Connectivity() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "2001:4860:4860::8888", port: 53, family: 6 });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function main() {
  const started = Date.now();
  const ref = String(process.env.PHASE18_LOAD_REF || "").trim();
  if (!ref) throw new Error("PHASE18_LOAD_REF_REQUIRED");
  if (ref !== EXPECTED_REF) {
    throw new Error(`PHASE18_UNEXPECTED_PROJECT_REF: ${ref}`);
  }
  process.env.PHASE18_LOADCERT = "1";

  const rawUrl = String(process.env.PHASE18_DATABASE_URL || "").trim();
  if (!rawUrl) throw new Error("PHASE18_CLOUD_DB_URL_REQUIRED");

  const asserted = assertIsolatedCloudPostgresUrl(rawUrl, "PHASE18_DATABASE_URL");
  const parsed = parseDbUrl(asserted.connectionString);
  const host = String(parsed.hostname || "").toLowerCase();
  const identity = asserted.identity;

  const prodRefs = countProductionTargetReferences(asserted.connectionString, ref);
  if (prodRefs !== 0) throw new Error(`PRODUCTION_TARGET_REFERENCES=${prodRefs}`);

  const { ipv4, ipv6 } = await resolveDns(host);
  const runnerHasIpv6 = await probeIpv6Connectivity();
  const ipv4Compatible = ipv4.length > 0;

  if (!ipv4Compatible) {
    throw new Error(`PHASE18_CLOUD_DB_NO_IPV4: host=${host}`);
  }
  if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
    throw new Error("PHASE18_CLOUD_DB_DIRECT_IPV6_FORBIDDEN");
  }

  const { client } = createPhase18PgClient(pg, {
    print: false,
    connectionTimeoutMillis: 10000,
  });

  let selectOk = false;
  let remoteHead = null;
  let markerCount = 0;
  let tlsVerified = false;

  try {
    await client.connect();
    tlsVerified = true; // Node pg with rejectUnauthorized:true completed handshake
    const one = await client.query("select 1::int as n");
    selectOk = Number(one.rows[0]?.n) === 1;

    const expectedHead = localMigrationHead();
    const mig = await client.query(
      `select version
       from supabase_migrations.schema_migrations
       order by version desc
       limit 1`,
    );
    remoteHead = String(mig.rows[0]?.version || "");
    if (!remoteHead) throw new Error("PHASE18_REMOTE_MIGRATION_HEAD_MISSING");
    if (remoteHead !== expectedHead) {
      // Allow remote ahead only if local head is applied (prefix/contains check fail-closed exact).
      const applied = await client.query(
        `select 1 from supabase_migrations.schema_migrations where version = $1 limit 1`,
        [expectedHead],
      );
      if (!applied.rowCount) {
        throw new Error(
          `PHASE18_MIGRATION_HEAD_MISMATCH local=${expectedHead} remote=${remoteHead}`,
        );
      }
    }

    const marker = await client.query(
      `select count(*)::int as n
       from public.providers
       where slug like 'p18scale-prov-%'`,
    );
    markerCount = Number(marker.rows[0]?.n || 0);
    if (markerCount < 1) {
      throw new Error("PHASE18_SYNTHETIC_MARKER_MISSING: expected p18scale-prov-%");
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }

  // Re-resolve for printed identity (redacted).
  const resolved = resolvePhase18DatabaseUrl({ print: false });

  const report = {
    phase: "18SCALE",
    CLOUD_DB_CONNECTIVITY: selectOk && tlsVerified && ipv4Compatible ? "PASS" : "FAIL",
    CLOUD_DB_TARGET_PROJECT: ref,
    CLOUD_DB_IPV4_COMPATIBLE: ipv4Compatible ? "YES" : "NO",
    CLOUD_DB_TLS_VERIFIED: tlsVerified ? "YES" : "NO",
    PRODUCTION_TARGET_REFERENCES: prodRefs,
    connection_method: "supavisor_session_pooler_ipv4",
    redacted_identity: resolved.identity || identity,
    dns: {
      host,
      ipv4_count: ipv4.length,
      ipv6_count: ipv6.length,
      // Do not print full address lists with credentials context; counts + family only.
      ipv4_sample_prefix: ipv4.slice(0, 2).map((a) => a.split(".").slice(0, 2).join(".") + ".x.x"),
      runner_ipv6_connectivity: runnerHasIpv6 ? "YES" : "NO",
    },
    migration: {
      local_head: localMigrationHead(),
      remote_head: remoteHead,
    },
    synthetic_marker: {
      kind: "providers.slug like p18scale-prov-%",
      count: markerCount,
    },
    select_1: selectOk,
    duration_ms: Date.now() - started,
    stamped_at: new Date().toISOString(),
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "cloud-db-connectivity-preflight.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));

  if (report.CLOUD_DB_CONNECTIVITY !== "PASS") process.exit(2);
  if (report.CLOUD_DB_TARGET_PROJECT !== EXPECTED_REF) process.exit(2);
  if (report.CLOUD_DB_IPV4_COMPATIBLE !== "YES") process.exit(2);
  if (report.CLOUD_DB_TLS_VERIFIED !== "YES") process.exit(2);
  if (report.PRODUCTION_TARGET_REFERENCES !== 0) process.exit(2);
}

main().catch((e) => {
  const msg = String(e?.message || e);
  const fail = {
    CLOUD_DB_CONNECTIVITY: "FAIL",
    CLOUD_DB_TARGET_PROJECT: String(process.env.PHASE18_LOAD_REF || ""),
    error: msg.slice(0, 500),
    stamped_at: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      path.join(OUT, "cloud-db-connectivity-preflight.json"),
      JSON.stringify(fail, null, 2),
    );
  } catch {
    /* ignore */
  }
  console.error(msg);
  process.exit(2);
});
