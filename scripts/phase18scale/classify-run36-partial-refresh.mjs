#!/usr/bin/env node
/**
 * Classify run #36 partial canonical refresh checkpoints (redacted).
 * Never prints tokens/emails.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOADCERT_REF,
  hashTokenFingerprint,
  isReusableSession,
  loadNdjson,
  publicMetaFromRecord,
  toCanonicalRecord,
} from "./lib/canonical-session-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(
  __dirname,
  "../../docs/rc/phase18scale/artifacts-30081403524/phase18-job-authenticated-session-pool",
);
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const candidates = [
    "sessions-canonical-10000.checkpoint.ndjson",
    "sessions-canonical-10000.ndjson",
  ];
  let sourceFile = null;
  let rows = [];
  for (const name of candidates) {
    const p = path.join(ART, name);
    if (!fs.existsSync(p)) continue;
    const loaded = await loadNdjson(p);
    if (loaded.length) {
      sourceFile = name;
      rows = loaded;
      break;
    }
  }
  if (!rows.length) throw new Error("PHASE18_RUN36_CANONICAL_MISSING");

  const byUser = new Map();
  let invalid = 0;
  let reusable = 0;
  let unknown = 0;
  let dupCurrent = 0;
  const genCounts = {};
  const classified = [];

  for (const raw of rows) {
    const rec = toCanonicalRecord(raw, {
      source_run_id: 30081403524,
      project_ref: LOADCERT_REF,
    });
    const key = rec.user_id;
    if (!key || !isReusableSession(rec)) {
      invalid += 1;
      classified.push({
        index: rec.index,
        user_id: rec.user_id || null,
        class: "INVALID_PARTIAL_RECORD",
        reusable: false,
      });
      continue;
    }
    if (byUser.has(key)) {
      dupCurrent += 1;
      const prev = byUser.get(key);
      const prevTs = Date.parse(prev.last_successful_refresh_at || 0) || 0;
      const nextTs = Date.parse(rec.last_successful_refresh_at || 0) || 0;
      if (nextTs >= prevTs) byUser.set(key, rec);
      continue;
    }
    byUser.set(key, rec);
    const gen = Number(rec.refresh_generation || 1);
    genCounts[gen] = (genCounts[gen] || 0) + 1;
    const hasAtomicRefresh =
      Boolean(rec.refreshed_at) &&
      Number(rec.refresh_generation || 1) > 1 &&
      Boolean(rec.refresh_fingerprint);
    if (hasAtomicRefresh) {
      reusable += 1;
      classified.push({
        index: rec.index,
        user_id: rec.user_id,
        identity_redacted: rec.identity_redacted,
        refresh_generation: gen,
        last_successful_refresh_at: rec.last_successful_refresh_at,
        class: "REUSABLE_SUCCESS",
        reusable: true,
        project_ref_ok: rec.project_ref === LOADCERT_REF,
        company_ok: Boolean(rec.company_id),
        provider_ok: Boolean(rec.provider_id),
      });
    } else if (isReusableSession(rec)) {
      // Pre-refresh issued session still checkpointed; safe as cycle-1 input, not as cycle-1 success.
      reusable += 1;
      classified.push({
        index: rec.index,
        user_id: rec.user_id,
        identity_redacted: rec.identity_redacted,
        refresh_generation: gen,
        last_successful_refresh_at: rec.last_successful_refresh_at,
        class: "REUSABLE_PRE_REFRESH_CANONICAL",
        reusable: true,
        project_ref_ok: rec.project_ref === LOADCERT_REF,
        company_ok: Boolean(rec.company_id),
        provider_ok: Boolean(rec.provider_id),
      });
    } else {
      unknown += 1;
      classified.push({
        index: rec.index,
        user_id: rec.user_id,
        class: "UNKNOWN_TOKEN_STATE",
        reusable: false,
      });
    }
  }

  const unique = [...byUser.values()].sort((a, b) => Number(a.index) - Number(b.index));
  const sourceChecksum = crypto
    .createHash("sha256")
    .update(unique.map((r) => `${r.user_id}:${r.refresh_fingerprint}:${r.refresh_generation}`).join("|"))
    .digest("hex");

  const c1Path = path.join(ART, "session-refresh-canonical-cycle-1.json");
  const c2Path = path.join(ART, "session-refresh-canonical-cycle-2.json");
  const c1 = fs.existsSync(c1Path) ? JSON.parse(fs.readFileSync(c1Path, "utf8")) : null;
  const c2 = fs.existsSync(c2Path) ? JSON.parse(fs.readFileSync(c2Path, "utf8")) : null;

  const report = {
    phase: "18SCALE",
    run_id: 30081403524,
    source_file: sourceFile,
    RUN36_PARTIAL_SUCCESSES_CLASSIFIED: "100%",
    RUN36_ROWS_SEEN: rows.length,
    RUN36_UNIQUE_USERS: unique.length,
    RUN36_REUSABLE_SUCCESSES: classified.filter((c) => c.class === "REUSABLE_SUCCESS").length,
    RUN36_REUSABLE_PRE_REFRESH: classified.filter((c) => c.class === "REUSABLE_PRE_REFRESH_CANONICAL")
      .length,
    RUN36_INVALID_PARTIAL_RECORDS: invalid,
    RUN36_DUPLICATE_CURRENT_GENERATIONS: dupCurrent,
    RUN36_UNKNOWN_TOKEN_STATE: unknown,
    generation_counts: genCounts,
    CANONICAL_SESSION_SOURCE_RUN: 30081403524,
    CANONICAL_SESSION_SOURCE_CHECKSUM: sourceChecksum,
    cycle1_report: c1
      ? {
          REFRESH_SUCCESS: c1.REFRESH_SUCCESS,
          REFRESH_FAILURES: c1.REFRESH_FAILURES,
          SESSION_REFRESH_CYCLE: c1.SESSION_REFRESH_CYCLE,
        }
      : null,
    cycle2_report: c2
      ? {
          REFRESH_SUCCESS: c2.REFRESH_SUCCESS,
          REFRESH_FAILURES: c2.REFRESH_FAILURES,
          SESSION_REFRESH_CYCLE: c2.SESSION_REFRESH_CYCLE,
        }
      : null,
    NOTE: "Partial rotated successes are only reusable when refresh_generation>1 and refreshed_at present (atomic checkpoint). Otherwise use as cycle-1 input only.",
    redacted_sample: classified.filter((c) => c.reusable).slice(0, 5).map((c) => ({
      index: c.index,
      class: c.class,
      refresh_generation: c.refresh_generation,
    })),
    stamped_at: new Date().toISOString(),
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "run36-partial-refresh-classification.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(__dirname, "../../docs/rc/phase18scale/artifacts-30081403524/run36-partial-refresh-classification.json"),
    JSON.stringify(report, null, 2),
  );
  // Public meta only (no tokens) for evidence of store shape.
  const publicRows = unique.slice(0, 3).map((r) => publicMetaFromRecord(r));
  fs.writeFileSync(
    path.join(OUT, "run36-canonical-public-sample.json"),
    JSON.stringify({ sample: publicRows, hash_probe: hashTokenFingerprint("x") }, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
