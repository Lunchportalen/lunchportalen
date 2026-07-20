/**
 * PHASE 18SCALE — load-environment env loader.
 * Allows: local Supabase (127.0.0.1 / localhost / kong) OR explicit PHASE18_LOAD_REF.
 * Hard-fails on production. Shared staging refused unless PHASE18_ALLOW_STAGING_ISOLATION=1
 * with proven isolation attestation file present.
 */
import fs from "node:fs";
import path from "node:path";

export const PROD_REF = "hkpokyapzarefrgqzkos";
export const STAGING_REF = "uigxsboqeruxflgzqztl";
export const MARK = "PHASE18_SCALE_SYNTHETIC";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v.replace(/\\n$/, "").trim();
  }
  return out;
}

function isLocalUrl(url) {
  const u = String(url || "").toLowerCase();
  return (
    u.includes("127.0.0.1") ||
    u.includes("localhost") ||
    u.includes("0.0.0.0") ||
    u.includes(":54321")
  );
}

export function loadPhase18Env(extraPaths = []) {
  const candidates = [
    ...extraPaths,
    path.resolve(process.cwd(), ".env.phase18.local"),
    path.resolve(process.cwd(), ".env.local"),
  ];
  let loaded = {};
  let source = null;
  for (const p of candidates) {
    const parsed = parseEnvFile(p);
    const url = parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL || "";
    if (!url) continue;
    if (url.includes(PROD_REF)) continue;
    if (isLocalUrl(url) || parsed.PHASE18_LOAD_REF) {
      loaded = parsed;
      source = p;
      break;
    }
  }
  // Phase18 file wins over ambient staging/.env.local injection for target keys.
  const overrideKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PHASE18_LOAD_REF",
    "PHASE18_BASE_URL",
    "PHASE18_ALLOW_STAGING_ISOLATION",
    "PHASE18_DATABASE_URL",
    "SUPABASE_LOCAL_DB_URL",
    "PHASE18_SERVICE_DATE",
  ];
  for (const [k, v] of Object.entries(loaded)) {
    if (overrideKeys.includes(k) || process.env[k] == null || process.env[k] === "") {
      process.env[k] = v;
    }
  }

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!url) throw new Error("PHASE18_ENV_MISSING: NEXT_PUBLIC_SUPABASE_URL");
  if (url.includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (/app\.lunchportalen\.no/i.test(String(process.env.PHASE18_BASE_URL || ""))) {
    throw new Error("PRODUCTION_APP_URL_FORBIDDEN");
  }

  const allowStaging = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_ALLOW_STAGING_ISOLATION || "").toLowerCase(),
  );
  if (url.includes(STAGING_REF) && !allowStaging) {
    throw new Error(
      "SHARED_STAGING_REFUSED: Phase 18 full load requires dedicated local/branch env. Set PHASE18_ALLOW_STAGING_ISOLATION=1 only with isolation attestation.",
    );
  }
  if (!isLocalUrl(url) && !process.env.PHASE18_LOAD_REF && !allowStaging) {
    throw new Error(`PHASE18_TARGET_AMBIGUOUS: url=${url}`);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
    throw new Error("ANON key missing");
  }
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  return {
    source,
    url,
    ref: process.env.PHASE18_LOAD_REF || (isLocalUrl(url) ? "local" : STAGING_REF),
    isolated: true,
    mark: MARK,
  };
}

export function assertNotProduction(url = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (String(url || "").includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
}
