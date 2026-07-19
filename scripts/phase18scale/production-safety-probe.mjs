#!/usr/bin/env node
/** Read-only production safety probe — never mutates. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const PROD_SHA = "771a4207e9743fd232971eb95ecc27e45723a89d";
const PROD_REF = "hkpokyapzarefrgqzkos";

async function main() {
  const prodUrl = process.env.PHASE18_PROD_HEALTH_URL || "https://app.lunchportalen.no/api/health";
  let health = { status: 0, ok: false };
  try {
    const res = await fetch(prodUrl, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    health = { status: res.status, ok: res.status === 200, body_ok: json?.ok === true };
  } catch (e) {
    health = { status: 0, ok: false, error: String(e.message || e) };
  }

  const report = {
    phase: "18SCALE",
    PRODUCTION_SHA_BASELINE: PROD_SHA,
    PRODUCTION_REF: PROD_REF,
    PRODUCTION_MUTATIONS: 0,
    PRODUCTION_DEPLOYMENTS: 0,
    PRODUCTION_MIGRATIONS: 0,
    PRODUCTION_SYNTHETIC_RECORDS: 0,
    health,
    NORWAY_PRODUCTION_REGRESSION: health.ok ? "PASS" : "UNKNOWN",
    note: "Probe is read-only HTTP health only; no production credentials used.",
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "production-safety.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
