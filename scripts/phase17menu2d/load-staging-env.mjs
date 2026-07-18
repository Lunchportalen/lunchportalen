/**
 * Load staging-only env. Hard-fail if production Supabase is referenced.
 */
import fs from "node:fs";
import path from "node:path";

export const STAGING_REF = "uigxsboqeruxflgzqztl";
export const PROD_REF = "hkpokyapzarefrgqzkos";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v.replace(/\\n$/, "").trim();
  }
  return out;
}

export function loadStagingEnv(extraPaths = []) {
  const candidates = [
    ...extraPaths,
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "../lunchportalen/.env.local"),
    "C:/prosjekter/lunchportalen/.env.local",
    "C:/prosjekter/lunchportalen-16no/.env.local",
  ];
  let loaded = {};
  let source = null;
  for (const p of candidates) {
    const parsed = parseEnvFile(p);
    if (parsed.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGING_REF)) {
      loaded = parsed;
      source = p;
      break;
    }
  }
  for (const [k, v] of Object.entries(loaded)) {
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  }
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (!url.includes(STAGING_REF)) {
    throw new Error(
      `STAGING_TARGET_REQUIRED: NEXT_PUBLIC_SUPABASE_URL must include ${STAGING_REF} (got host=${url.replace(/^https?:\/\//, "").split("/")[0] || "missing"}; source=${source || "env"})`,
    );
  }
  if (url.includes(PROD_REF)) {
    throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing for staging");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing for staging");
  }
  return { source, url: url.replace(/\/$/, ""), ref: STAGING_REF };
}
