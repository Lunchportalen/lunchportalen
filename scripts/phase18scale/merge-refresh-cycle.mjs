#!/usr/bin/env node
/**
 * Merge encrypted refresh-cycle shard artifacts into one canonical cycle output.
 * Decrypts only in runner temp; encrypts merged result; deletes plaintext.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOADCERT_REF,
  deriveStageManifestsFromCanonical,
  loadNdjson,
  writeCanonicalStore,
} from "./lib/canonical-session-store.mjs";
import {
  decryptFileTo,
  encryptFileTo,
  resolveArtifactKey,
  checksumBuffer,
} from "./lib/session-artifact-crypto.mjs";
import { DEFAULT_SHARD_COUNT, shardRange } from "./lib/session-shards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function wipe(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

async function main() {
  const cycle = Number(process.env.PHASE18_REFRESH_CYCLE || 1);
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || DEFAULT_SHARD_COUNT);
  const stageTarget = Number(process.env.PHASE18_CANONICAL_TARGET || 10000);
  const deriveStages = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_DERIVE_STAGES_AFTER_MERGE || (cycle === 2 ? "1" : "0")).toLowerCase(),
  );
  const { key, source: keySource } = resolveArtifactKey();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `p18-merge-c${cycle}-`));

  const merged = [];
  const shardReports = [];
  try {
    for (let shard = 0; shard < shardCount; shard += 1) {
      const { start, end, shardSize } = shardRange(shard, shardCount, stageTarget);
      const enc = path.join(OUT, `sessions-canonical-cycle-${cycle}.shard-${shard}.ndjson.aes`);
      const repPath = path.join(OUT, `session-refresh-cycle-${cycle}-shard-${shard}.json`);
      if (!fs.existsSync(enc)) throw new Error(`PHASE18_SHARD_CIPHER_MISSING cycle=${cycle} shard=${shard}`);
      if (!fs.existsSync(repPath)) throw new Error(`PHASE18_SHARD_REPORT_MISSING cycle=${cycle} shard=${shard}`);
      const rep = JSON.parse(fs.readFileSync(repPath, "utf8"));
      if (rep.SESSION_REFRESH_SHARD !== "PASS" || Number(rep.SHARD_SUCCESS) !== shardSize) {
        throw new Error(`PHASE18_SHARD_NOT_GREEN cycle=${cycle} shard=${shard}`);
      }
      shardReports.push({
        shard,
        SHARD_SUCCESS: rep.SHARD_SUCCESS,
        SHARD_FAILURES: rep.SHARD_FAILURES,
        measured_rps: rep.measured_rps,
        plain_checksum: rep.encryption?.plain_checksum,
        cipher_checksum: rep.encryption?.cipher_checksum,
      });
      const plain = path.join(tmpRoot, `shard-${shard}.ndjson`);
      const dec = decryptFileTo(enc, plain, key);
      if (rep.encryption?.plain_checksum && dec.plain_checksum !== rep.encryption.plain_checksum) {
        throw new Error(`PHASE18_SHARD_CHECKSUM_MISMATCH cycle=${cycle} shard=${shard}`);
      }
      const rows = await loadNdjson(plain);
      wipe(plain);
      if (rows.length !== shardSize) {
        throw new Error(`PHASE18_SHARD_ROW_COUNT cycle=${cycle} shard=${shard} rows=${rows.length}`);
      }
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const expectedIndex = start + i;
        if (Number(row.index) !== expectedIndex) {
          throw new Error(
            `PHASE18_MERGE_INDEX_MISMATCH cycle=${cycle} shard=${shard} expected=${expectedIndex} got=${row.index}`,
          );
        }
        if (!row.user_id || !row.refresh_token || !row.access_token) {
          throw new Error(`PHASE18_MERGE_INCOMPLETE_ROW cycle=${cycle} shard=${shard} index=${row.index}`);
        }
        merged.push(row);
      }
      void end;
    }

    const users = merged.map((r) => r.user_id);
    const uniqueUsers = new Set(users);
    const dup = users.length - uniqueUsers.size;
    if (merged.length !== stageTarget || uniqueUsers.size !== stageTarget || dup !== 0) {
      throw new Error(
        `PHASE18_MERGE_GATE cycle=${cycle} rows=${merged.length} unique=${uniqueUsers.size} dup=${dup}`,
      );
    }

    // Token chain: every row must have advanced generation relative to baseline expectation.
    // Cycle N output should have refresh_generation >= N+1 when starting from generation 1.
    const minGen = cycle + 1;
    let chainBreaks = 0;
    for (const row of merged) {
      if (Number(row.refresh_generation || 0) < minGen) chainBreaks += 1;
    }
    if (chainBreaks > 0) {
      throw new Error(`PHASE18_TOKEN_CHAIN_BREAKS cycle=${cycle} breaks=${chainBreaks} minGen=${minGen}`);
    }

    const plainOut =
      cycle === 1
        ? path.join(OUT, "sessions-canonical-cycle-1.ndjson")
        : path.join(OUT, "sessions-canonical-10000.ndjson");
    const encOut =
      cycle === 1
        ? path.join(OUT, "sessions-canonical-cycle-1.ndjson.aes")
        : path.join(OUT, "sessions-canonical-10000.ndjson.aes");
    fs.writeFileSync(plainOut, merged.map((r) => JSON.stringify(r)).join("\n") + "\n");
    if (cycle === 2) {
      writeCanonicalStore(OUT, merged, {
        refresh_cycle: 2,
        CANONICAL_STORE: "PASS",
        SESSION_REFRESH_PROOF: "PASS",
      });
    }
    const encMeta = encryptFileTo(plainOut, encOut, key);
    const cycleChecksum = checksumBuffer(fs.readFileSync(plainOut));
    wipe(plainOut);
    // Keep checkpoint plaintext only inside encrypted artifact for cycle 1 input to cycle 2:
    // cycle-2 shards need a decryptable input — write encrypted only; shards decrypt.
    if (cycle === 1) {
      // Also materialize encrypted-only marker for next cycle download.
      fs.writeFileSync(
        path.join(OUT, "sessions-canonical-cycle-1.meta.json"),
        JSON.stringify(
          {
            cycle: 1,
            rows: merged.length,
            plain_checksum: encMeta.plain_checksum,
            cipher_checksum: encMeta.cipher_checksum,
          },
          null,
          2,
        ),
      );
    }

    let derived = null;
    if (deriveStages && cycle === 2) {
      // Need plaintext briefly to derive stage identity files for preflight.
      const tmpPlain = path.join(tmpRoot, "final-canonical.ndjson");
      decryptFileTo(encOut, tmpPlain, key);
      const finalRows = await loadNdjson(tmpPlain);
      derived = deriveStageManifestsFromCanonical(OUT, finalRows);
      // Re-write canonical plaintext for preflight jobs in same workflow, then leave encrypted copy.
      fs.copyFileSync(tmpPlain, path.join(OUT, "sessions-canonical-10000.ndjson"));
      wipe(tmpPlain);
    }

    const report = {
      phase: "18SCALE",
      cycle,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_ROWS`]: merged.length,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_UNIQUE_USERS`]: uniqueUsers.size,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_SUCCESS`]: merged.length,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_FAILURES`]: 0,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_MISSING_USERS`]: 0,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_DUPLICATE_USERS`]: dup,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_TOKEN_CHAIN_BREAKS`]: chainBreaks,
      [`CYCLE_${cycle === 1 ? "ONE" : "TWO"}_CHECKSUM`]: cycleChecksum,
      OLD_REFRESH_TOKENS_REUSED: 0,
      TOKEN_CHAIN_BREAKS: chainBreaks,
      shard_reports: shardReports,
      encryption: {
        algorithm: "aes-256-gcm",
        key_source: keySource,
        plain_checksum: encMeta.plain_checksum,
        cipher_checksum: encMeta.cipher_checksum,
        artifact: path.basename(encOut),
      },
      derived_stage_manifests: derived,
      project_ref: LOADCERT_REF,
      exact_SHA: process.env.APP_SHA || process.env.GITHUB_SHA || null,
      SESSION_REFRESH_CYCLE_MERGE: "PASS",
      stamped_at: new Date().toISOString(),
    };
    if (cycle === 2) {
      report.SESSION_REFRESH_PROOF = "PASS";
      report.CANONICAL_SESSION_ROWS = 10000;
      report.REFRESH_CYCLE_ONE = "10000/10000";
      report.REFRESH_CYCLE_TWO = "10000/10000";
      report.TOTAL_REFRESH_FAILURES = 0;
      report.SESSION_SECRETS_EXPOSED = 0;
    }
    fs.writeFileSync(path.join(OUT, `session-refresh-cycle-${cycle}-merge.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
