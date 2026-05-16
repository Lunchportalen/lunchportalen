#!/usr/bin/env node
/**
 * READ-ONLY: introspection mot Postgres (pg_policies, pg_proc) vs tests/rls/golden-rls-snapshot.json.
 * Exit: 0 = match, 1 = drift, 2 = config/connection (ikke drift).
 *
 * Env: DATABASE_URL (vinner) eller SUPABASE_POSTGRES_URL. Legger til sslmode=require hvis URL mangler det.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_REL = join(__dirname, "..", "tests", "rls", "golden-rls-snapshot.json");

const AUDIT_TABLES = ["orders", "order_items", "menu_service_days", "menu_service_day_items"];

const STATEMENT_TIMEOUT_MS = 8000;
const CONNECTION_TIMEOUT_MS = 10000;

function checkedAt() {
  return new Date().toISOString();
}

function loadGolden() {
  const raw = readFileSync(GOLDEN_REL, "utf8");
  return JSON.parse(raw);
}

function resolveDbUrl() {
  const db = (process.env.DATABASE_URL ?? "").trim();
  const supa = (process.env.SUPABASE_POSTGRES_URL ?? "").trim();
  return db ? db : supa ? supa : "";
}

/**
 * Sikrer sslmode=require (Supabase); statement_timeout kun via SET på sesjon (se client connect).
 */
function ensureSslRequire(connectionString) {
  let u;
  try {
    u = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const sm = u.searchParams.get("sslmode");
  if (!sm || sm === "prefer" || sm === "allow") {
    u.searchParams.set("sslmode", "require");
  }
  return u.toString();
}

function extractIdentityArgsFromSignature(fullSig) {
  const open = fullSig.indexOf("(");
  const close = fullSig.lastIndexOf(")");
  if (open === -1 || close === -1 || close <= open) {
    throw new Error(`Ugyldig signatur i golden: ${fullSig}`);
  }
  return fullSig.slice(open + 1, close);
}

function findSignatureForProname(expectedPrivateFunctions, proname) {
  const prefix = `${proname}(`;
  const hits = expectedPrivateFunctions.filter((s) => s.startsWith(prefix));
  if (hits.length === 0) {
    throw new Error(`capturedPrivateFunctionDefMd5 har «${proname}», men ingen signatur i expectedPrivateFunctions`);
  }
  if (hits.length > 1) {
    throw new Error(`Flere signaturer for «${proname}» i golden — tvetydig`);
  }
  return hits[0];
}

function printReport(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

async function mainAsync() {
  const urlRaw = resolveDbUrl();
  if (!urlRaw) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "MISSING_DATABASE_URL",
      message:
        "Sett DATABASE_URL eller SUPABASE_POSTGRES_URL (DATABASE_URL har forrang). Legg inn som GitHub secret for scheduled drift-sjekk.",
    });
    return 2;
  }

  let golden;
  try {
    golden = loadGolden();
  } catch (e) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "GOLDEN_READ_FAILED",
      message: String(e?.message ?? e),
    });
    return 2;
  }

  const expectedPolicies = golden.expectedPolicies;
  const expectedPrivateFunctions = golden.expectedPrivateFunctions;
  const capturedMd5 = golden.capturedPrivateFunctionDefMd5 ?? {};

  const connectionString = ensureSslRequire(urlRaw);
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

      const { rows: policyRows } = await client.query(
        `select schemaname || '.' || tablename || ':' || policyname as k
         from pg_policies
         where schemaname = 'public'
           and tablename = any($1::text[])`,
        [AUDIT_TABLES],
      );
      const havePolicies = new Set(policyRows.map((r) => r.k));
      const expPolicies = new Set(expectedPolicies);
      const policiesMissing = [...expPolicies].filter((k) => !havePolicies.has(k)).sort();
      const policiesExtra = [...havePolicies].filter((k) => !expPolicies.has(k)).sort();

      const { rows: privRows } = await client.query(
        `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private'`,
      );
      const havePriv = new Set(privRows.map((r) => r.sig));
      const expPriv = new Set(expectedPrivateFunctions);
      const privMissing = [...expPriv].filter((s) => !havePriv.has(s)).sort();
      const privExtra = [...havePriv].filter((s) => !expPriv.has(s)).sort();

      const definitionDrifted = [];
      for (const proname of Object.keys(capturedMd5).sort()) {
        const expectedMd5 = capturedMd5[proname];
        let fullSig;
        try {
          fullSig = findSignatureForProname(expectedPrivateFunctions, proname);
        } catch (e) {
          definitionDrifted.push({
            kind: "golden_config",
            function: proname,
            detail: String(e?.message ?? e),
          });
          continue;
        }
        const identityArgs = extractIdentityArgsFromSignature(fullSig);
        const { rows: defRows } = await client.query(
          `select md5(pg_get_functiondef(p.oid)) as def_md5
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private'
             and p.proname = $1
             and pg_get_function_identity_arguments(p.oid) = $2`,
          [proname, identityArgs],
        );
        if (defRows.length === 0) {
          definitionDrifted.push({
            kind: "missing",
            function: proname,
            expectedMd5,
            actualMd5: null,
            detail: "Ingen private-funksjon matchet proname + identitetsargumenter (L3).",
          });
          continue;
        }
        if (defRows.length > 1) {
          definitionDrifted.push({
            kind: "ambiguous",
            function: proname,
            expectedMd5,
            detail: `Flere overloads matchet identitetsargumenter (${defRows.length} rader).`,
          });
          continue;
        }
        const actualMd5 = defRows[0].def_md5;
        if (actualMd5 !== expectedMd5) {
          definitionDrifted.push({
            kind: "changed",
            function: proname,
            expectedMd5,
            actualMd5,
            detail: "md5(pg_get_functiondef(oid)) avviker fra golden.capturedPrivateFunctionDefMd5.",
          });
        }
      }

      const goldenConfigIssues = definitionDrifted.filter((d) => d.kind === "golden_config");
      const definitionDriftExcludingGolden = definitionDrifted.filter((d) => d.kind !== "golden_config");

      const hasPolicyDrift = policiesMissing.length > 0 || policiesExtra.length > 0;
      const hasPrivDrift = privMissing.length > 0 || privExtra.length > 0;
      const hasDefDrift = definitionDriftExcludingGolden.length > 0;
      const hasGoldenConfigError = goldenConfigIssues.length > 0;

      const ok = !hasGoldenConfigError && !hasPolicyDrift && !hasPrivDrift && !hasDefDrift;

      const report = {
        ok,
        checkedAt: checkedAt(),
        policies: {
          checked: expectedPolicies.length,
          missing: policiesMissing,
          extra: policiesExtra,
        },
        privateFunctions: {
          checked: expectedPrivateFunctions.length,
          missing: privMissing,
          extra: privExtra,
        },
        definitionHashes: {
          checked: Object.keys(capturedMd5).length,
          drifted: definitionDrifted,
        },
      };

      printReport(report);
      if (hasGoldenConfigError) {
        return 2;
      }
      return ok ? 0 : 1;
    } finally {
      client.release();
    }
  } catch (e) {
    printReport({
      ok: false,
      checkedAt: checkedAt(),
      error: "DATABASE_ERROR",
      message: String(e?.message ?? e),
    });
    return 2;
  } finally {
    await pool.end();
  }
}

function main() {
  mainAsync()
    .then((code) => process.exit(code))
    .catch((e) => {
      printReport({
        ok: false,
        checkedAt: checkedAt(),
        error: "UNEXPECTED_ERROR",
        message: String(e?.message ?? e),
      });
      process.exit(2);
    });
}

main();
