#!/usr/bin/env node
/**
 * Overlay refreshed/canary-rotated tokens onto the business active-load pool.
 * Never prints secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function loadNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function main() {
  const poolPath = path.join(OUT, "sessions-business-active-load.ndjson");
  const refreshPath = path.join(OUT, "sessions-auth-refresh-coverage.ndjson");
  const pool = loadNdjson(poolPath);
  const refreshed = loadNdjson(refreshPath);
  if (!pool.length) throw new Error("PHASE18_BUSINESS_POOL_MISSING");
  if (!refreshed.length) throw new Error("PHASE18_REFRESH_COVERAGE_MISSING");

  const byUser = new Map(pool.map((r) => [r.user_id, r]));
  let overlays = 0;
  for (const r of refreshed) {
    if (!r?.user_id || !r?.refresh_token || !r?.access_token) continue;
    const prev = byUser.get(r.user_id);
    if (!prev) continue;
    byUser.set(r.user_id, { ...prev, ...r });
    overlays += 1;
  }
  const out = [...byUser.values()].sort((a, b) => a.index - b.index);
  const body = out.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(poolPath, body);
  fs.writeFileSync(path.join(OUT, "sessions.ndjson"), body);
  fs.writeFileSync(path.join(OUT, "sessions-business-active-load.checkpoint.ndjson"), body);
  const report = {
    phase: "18SCALE",
    pool_sessions: out.length,
    refreshed_overlays: overlays,
    PASS: overlays > 0 && out.length === pool.length,
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "merge-refreshed-into-business-pool.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.PASS) throw new Error("PHASE18_REFRESH_OVERLAY_FAIL");
}

main();
