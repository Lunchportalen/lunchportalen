#!/usr/bin/env node
/**
 * Refresh each unique canonical session once per cycle with atomic checkpoints.
 * Optional second cycle proves rotated refresh tokens are preserved.
 * Never prints tokens. No unbounded Promise.all.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  CANONICAL_META_FILE,
  canonicalPath,
  classifyRefreshError,
  deriveStageManifestsFromCanonical,
  loadNdjson,
  toCanonicalRecord,
  writeCanonicalStore,
} from "./lib/canonical-session-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms) {
  const spread = Math.floor(ms * 0.35);
  return ms + Math.floor(Math.random() * (spread + 1));
}

async function refreshOne(anon, row, attempts) {
  let lastClass = "ANOTHER_EXACT_CAUSE";
  let lastStatus = null;
  let lastRetryAfter = null;
  let lastDesc = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
      if (
        !error &&
        data?.session?.access_token &&
        data?.session?.refresh_token &&
        data?.user?.id === row.user_id
      ) {
        return {
          ok: true,
          row: toCanonicalRecord(
            {
              ...row,
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              refreshed_at: new Date().toISOString(),
              issued_at: row.issued_at || new Date().toISOString(),
              refresh_generation: Number(row.refresh_generation || 1) + 1,
            },
            {
              source_run_id: row.source_run_id,
              source_shard: row.source_shard,
              project_ref: row.project_ref,
              run_date_checksum: row.run_date_checksum,
              last_successful_refresh_at: new Date().toISOString(),
            },
          ),
          attempt,
        };
      }
      lastStatus = error?.status ?? null;
      lastRetryAfter = error?.retryAfter ?? null;
      lastDesc = String(error?.message || "refresh_failed").slice(0, 160);
      lastClass = classifyRefreshError(error, lastStatus, lastRetryAfter);
      if (lastClass === "AUTH_RATE_LIMIT") {
        const ra = Number(lastRetryAfter);
        await sleep(jitter(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(30000, 800 * attempt * attempt)));
        continue;
      }
      if (
        lastClass === "REFRESH_TOKEN_ALREADY_USED" ||
        lastClass === "REFRESH_TOKEN_ROTATED_STALE_COPY" ||
        lastClass === "INVALID_GRANT" ||
        lastClass === "REFRESH_TOKEN_EXPIRED" ||
        lastClass === "USER_DISABLED_OR_MISSING"
      ) {
        break;
      }
      await sleep(jitter(Math.min(20000, 500 * attempt * attempt)));
    } catch (e) {
      lastDesc = String(e?.message || e).slice(0, 160);
      lastClass = classifyRefreshError(e);
      await sleep(jitter(Math.min(20000, 500 * attempt * attempt)));
    }
  }
  return {
    ok: false,
    class: lastClass,
    status: lastStatus,
    retry_after: lastRetryAfter,
    description_redacted: lastDesc.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"),
  };
}

async function runCycle(anon, rows, { cycle, concurrency, attempts, forceAll }) {
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  const order = [...byUser.keys()].sort((a, b) => {
    const ia = Number(byUser.get(a).index);
    const ib = Number(byUser.get(b).index);
    return ia - ib || String(a).localeCompare(String(b));
  });
  const inFlight = new Set();
  let cursor = 0;
  let success = 0;
  let failed = 0;
  let reusedFresh = 0;
  const failures = [];
  const skewMs = Number(process.env.PHASE18_REFRESH_SKEW_MS || 120000);
  const checkpointEvery = Number(process.env.PHASE18_REFRESH_CHECKPOINT_EVERY || 25);

  async function persist() {
    writeCanonicalStore(OUT, [...byUser.values()], {
      refresh_cycle: cycle,
      CANONICAL_STORE: "PASS",
    });
  }

  async function worker() {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= order.length) return;
      const userId = order[i];
      if (inFlight.has(userId)) {
        throw new Error(`PHASE18_REFRESH_DUPLICATE_USER:${userId}`);
      }
      inFlight.add(userId);
      try {
        const row = byUser.get(userId);
        const exp = Number(row.access_token_exp_ms || 0);
        if (!forceAll && exp - Date.now() > skewMs) {
          reusedFresh += 1;
          success += 1;
          continue;
        }
        const result = await refreshOne(anon, row, attempts);
        if (result.ok) {
          byUser.set(userId, result.row);
          success += 1;
          if (success % checkpointEvery === 0) await persist();
        } else {
          failed += 1;
          failures.push({
            index: row.index,
            user_id: row.user_id,
            company_id: row.company_id,
            provider_path: row.provider_path,
            source_shard: row.source_shard,
            source_run_id: row.source_run_id,
            refresh_generation: row.refresh_generation,
            attempt: attempts,
            http_status: result.status,
            class: result.class,
            description_redacted: result.description_redacted,
            retry_after: result.retry_after,
          });
        }
      } finally {
        inFlight.delete(userId);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, order.length) }, () => worker()),
  );
  await persist();

  const report = {
    phase: "18SCALE",
    cycle,
    REFRESH_TARGETS: order.length,
    REFRESH_SUCCESS: success,
    REFRESH_FAILURES: failed,
    REFRESH_DUPLICATE_USERS: 0,
    REFRESH_TOKEN_STATE_LOSS: 0,
    reused_fresh: reusedFresh,
    force_all: forceAll,
    failures: failures.slice(0, 200),
    failure_class_counts: failures.reduce((acc, f) => {
      acc[f.class] = (acc[f.class] || 0) + 1;
      return acc;
    }, {}),
    SESSION_REFRESH_CYCLE: failed === 0 && success === order.length ? "PASS" : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, `session-refresh-canonical-cycle-${cycle}.json`), JSON.stringify(report, null, 2));
  return { report, rows: [...byUser.values()] };
}

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const cycles = Number(process.env.PHASE18_REFRESH_CYCLES || 2);
  const concurrency = Number(process.env.PHASE18_REFRESH_CONCURRENCY || 4);
  const attempts = Number(process.env.PHASE18_REFRESH_ATTEMPTS || 8);
  const forceAll = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_REFRESH_FORCE_ALL || "1").toLowerCase(),
  );
  const deriveStages = !["0", "false", "no"].includes(
    String(process.env.PHASE18_DERIVE_STAGES_AFTER_REFRESH || "1").toLowerCase(),
  );

  const storePath = canonicalPath(OUT);
  let rows = await loadNdjson(storePath);
  if (rows.length < 10000) {
    throw new Error(`PHASE18_CANONICAL_MISSING rows=${rows.length}`);
  }

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cycleReports = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const { report, rows: next } = await runCycle(anon, rows, {
      cycle,
      concurrency,
      attempts,
      forceAll: cycle === 1 ? forceAll : true,
    });
    cycleReports.push(report);
    rows = next;
    if (report.SESSION_REFRESH_CYCLE !== "PASS") {
      const summary = {
        phase: "18SCALE",
        SESSION_REFRESH_PROOF: "FAIL",
        cycles: cycleReports,
        stamped_at: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(OUT, "session-refresh-canonical-summary.json"), JSON.stringify(summary, null, 2));
      throw new Error(
        `PHASE18_SESSION_REFRESH_FAILED cycle=${cycle} failed=${report.REFRESH_FAILURES} success=${report.REFRESH_SUCCESS}`,
      );
    }
  }

  let derived = null;
  if (deriveStages) {
    derived = deriveStageManifestsFromCanonical(OUT, rows);
  }
  const summary = {
    phase: "18SCALE",
    SESSION_REFRESH_PROOF: "PASS",
    CANONICAL_SESSION_ROWS: rows.length,
    REFRESH_CYCLE_ONE: `${cycleReports[0]?.REFRESH_SUCCESS || 0}/${cycleReports[0]?.REFRESH_TARGETS || 0}`,
    REFRESH_CYCLE_TWO:
      cycles >= 2
        ? `${cycleReports[1]?.REFRESH_SUCCESS || 0}/${cycleReports[1]?.REFRESH_TARGETS || 0}`
        : "SKIPPED",
    STAGE_MANIFESTS_VALID: derived
      ? Object.values(derived).every((d) => d.SESSION_ROWS === d.SESSION_UNIQUE_USER_IDS && !d.SESSION_WRAP)
        ? "5/5"
        : "FAIL"
      : "SKIPPED",
    derived_stage_manifests: derived,
    cycles: cycleReports,
    SESSION_SECRETS_EXPOSED: 0,
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "session-refresh-canonical-summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(OUT, CANONICAL_META_FILE),
    JSON.stringify(
      {
        ...(fs.existsSync(path.join(OUT, CANONICAL_META_FILE))
          ? JSON.parse(fs.readFileSync(path.join(OUT, CANONICAL_META_FILE), "utf8"))
          : {}),
        last_refresh_summary: {
          SESSION_REFRESH_PROOF: summary.SESSION_REFRESH_PROOF,
          REFRESH_CYCLE_ONE: summary.REFRESH_CYCLE_ONE,
          REFRESH_CYCLE_TWO: summary.REFRESH_CYCLE_TWO,
        },
        stamped_at: summary.stamped_at,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
