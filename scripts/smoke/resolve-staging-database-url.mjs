/**
 * Resolve staging (uigx) Postgres URL — never prod hkpoky.
 */
import fs from "node:fs";
import path from "node:path";

export const STAGING_REF = "uigxsboqeruxflgzqztl";
export const PROD_REF = "hkpokyapzarefrgqzkos";

export function loadEnvFiles(rootDir) {
  for (const file of [".env.local", ".env", "scripts/audit/staging-env-actual-2026-05-20.env"]) {
    const full = path.join(rootDir, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

export function resolveStagingDatabaseUrl() {
  const keys = [
    "STAGING_DATABASE_URL",
    "SUPABASE_STAGING_DATABASE_URL",
    "POSTGRES_URL_NON_POOLING",
    "SUPABASE_POSTGRES_URL",
    "DATABASE_URL",
  ];
  for (const key of keys) {
    const url = String(process.env[key] ?? "").trim();
    if (!url) continue;
    if (url.includes(PROD_REF) && !url.includes(STAGING_REF)) continue;
    if (url.includes(STAGING_REF)) return { key, url };
  }
  return null;
}

export function normalizePgUrl(url) {
  if (/sslmode=/i.test(url)) return url.replace(/sslmode=[^&]+/i, "sslmode=no-verify");
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;
}
