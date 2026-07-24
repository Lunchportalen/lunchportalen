#!/usr/bin/env node
/**
 * Build one canonical 10k session store from merged ramp-10000 (+ optional shards).
 * Never prints tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_META_FILE,
  LOADCERT_REF,
  deriveStageManifestsFromCanonical,
  isReusableSession,
  loadNdjson,
  toCanonicalRecord,
  writeCanonicalStore,
} from "./lib/canonical-session-store.mjs";
import { DEFAULT_SHARD_COUNT } from "./lib/session-shards.mjs";
import { stageSessionsPath } from "./lib/session-stages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const target = Number(process.env.PHASE18_CANONICAL_TARGET || 10000);
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || DEFAULT_SHARD_COUNT);
  const sourceRunId = process.env.PHASE18_SOURCE_RUN_ID || process.env.GITHUB_RUN_ID || null;
  const runDatePath = path.join(OUT, "phase18-run-date-manifest.json");
  let runDateChecksum = null;
  if (fs.existsSync(runDatePath)) {
    try {
      const rd = JSON.parse(fs.readFileSync(runDatePath, "utf8"));
      runDateChecksum = rd.checksum || rd.run_date_checksum || rd.contract_checksum || null;
    } catch {
      runDateChecksum = null;
    }
  }

  const byUser = new Map();
  const absorb = (rows, sourceShard = null) => {
    for (const row of rows) {
      if (!isReusableSession(row)) continue;
      const rec = toCanonicalRecord(row, {
        source_run_id: sourceRunId,
        source_shard: sourceShard ?? row.shard ?? null,
        project_ref: LOADCERT_REF,
        run_date_checksum: runDateChecksum,
      });
      const prev = byUser.get(rec.user_id);
      if (!prev) {
        byUser.set(rec.user_id, rec);
        continue;
      }
      // Prefer newer issued/refreshed generation; never keep two current versions.
      const prevTs = Date.parse(prev.last_successful_refresh_at || prev.issued_at || 0) || 0;
      const nextTs = Date.parse(rec.last_successful_refresh_at || rec.issued_at || 0) || 0;
      if (nextTs >= prevTs) byUser.set(rec.user_id, rec);
    }
  };

  const mergedPath = stageSessionsPath(OUT, "ramp-10000");
  absorb(await loadNdjson(mergedPath), null);
  for (let shard = 0; shard < shardCount; shard += 1) {
    absorb(await loadNdjson(path.join(OUT, `sessions-ramp-10000.shard-${shard}.ndjson`)), shard);
  }
  absorb(await loadNdjson(path.join(OUT, "sessions-ramp-10000.checkpoint.ndjson")), null);

  const unique = [...byUser.values()].sort(
    (a, b) => Number(a.index) - Number(b.index) || String(a.email).localeCompare(String(b.email)),
  );
  if (unique.length < target) {
    const report = {
      phase: "18SCALE",
      CANONICAL_SESSION_ROWS: unique.length,
      CANONICAL_UNIQUE_USERS: unique.length,
      target,
      CANONICAL_STORE: "FAIL",
      stamped_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(OUT, CANONICAL_META_FILE), JSON.stringify(report, null, 2));
    throw new Error(`PHASE18_CANONICAL_UNDERFILLED rows=${unique.length} target=${target}`);
  }

  const finalRows = unique.slice(0, target);
  const report = writeCanonicalStore(OUT, finalRows, {
    source_run_id: sourceRunId,
    CANONICAL_STORE: "PASS",
  });
  if (
    report.CANONICAL_SESSION_ROWS !== target ||
    report.CANONICAL_UNIQUE_USERS !== target ||
    report.CANONICAL_DUPLICATE_USERS !== 0 ||
    report.CANONICAL_WRONG_PROJECT !== 0 ||
    report.CANONICAL_MISSING_COMPANY !== 0 ||
    report.CANONICAL_MISSING_PROVIDER_PATH !== 0
  ) {
    throw new Error(`PHASE18_CANONICAL_GATE_FAIL ${JSON.stringify(report)}`);
  }

  const derived = deriveStageManifestsFromCanonical(OUT, finalRows);
  const out = { ...report, derived_stage_manifests: derived, STAGE_MANIFESTS_DERIVED: "YES" };
  fs.writeFileSync(path.join(OUT, CANONICAL_META_FILE), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
