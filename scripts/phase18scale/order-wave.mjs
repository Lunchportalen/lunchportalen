#!/usr/bin/env node
/** Wrapper: run k6 order-wave and persist summary JSON. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase18scale/evidence");

function main() {
  loadPhase18Env();
  const base = process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000";
  if (/app\.lunchportalen\.no/i.test(base)) throw new Error("PRODUCTION_APP_URL_FORBIDDEN");
  fs.mkdirSync(OUT, { recursive: true });
  const label = process.env.PHASE18_WAVE_LABEL || "orders-30m";
  const summaryPath = path.join(OUT, `order-wave-${label}.json`);
  const args = [
    "run",
    "--summary-export",
    summaryPath,
    path.join(__dirname, "k6/order-wave.js"),
  ];
  const env = {
    ...process.env,
    PHASE18_BASE_URL: base,
    PHASE18_SESSIONS_FILE:
      process.env.PHASE18_SESSIONS_FILE || path.join(OUT, "sessions.ndjson"),
  };
  const r = spawnSync("k6", args, { stdio: "inherit", env, cwd: ROOT, shell: true });
  const meta = {
    phase: "18SCALE",
    label,
    exit_code: r.status,
    base_url_host: base.replace(/^https?:\/\//, "").split("/")[0],
    summary: summaryPath,
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, `order-wave-${label}-meta.json`), JSON.stringify(meta, null, 2));
  process.exit(r.status ?? 1);
}

main();
