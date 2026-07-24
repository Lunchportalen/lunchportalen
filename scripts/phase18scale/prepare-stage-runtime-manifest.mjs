#!/usr/bin/env node
/**
 * Before an HTTP stage: refresh only that stage's users from canonical state,
 * atomically update canonical, regenerate temporary stage runtime manifest.
 * Never prints tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  canonicalPath,
  classifyRefreshError,
  loadNdjson,
  toCanonicalRecord,
  writeCanonicalStore,
} from "./lib/canonical-session-store.mjs";
import {
  resolveSessionStage,
  sessionTargetForStage,
  stageSessionsPath,
} from "./lib/session-stages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms) {
  const spread = Math.floor(ms * 0.35);
  return ms + Math.floor(Math.random() * (spread + 1));
}

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const stage = resolveSessionStage();
  const target = sessionTargetForStage(stage);
  const all = await loadNdjson(canonicalPath(OUT));
  if (all.length < 10000) throw new Error(`PHASE18_CANONICAL_MISSING rows=${all.length}`);

  const byUser = new Map(all.map((r) => [r.user_id, r]));
  const stageUsers = [...byUser.values()]
    .sort((a, b) => Number(a.index) - Number(b.index))
    .slice(0, target);
  if (stageUsers.length !== target) {
    throw new Error(`PHASE18_STAGE_UNDERFILL stage=${stage} rows=${stageUsers.length}`);
  }

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const concurrency = Number(process.env.PHASE18_REFRESH_CONCURRENCY || 4);
  const attempts = Number(process.env.PHASE18_REFRESH_ATTEMPTS || 8);
  const skewMs = Number(process.env.PHASE18_REFRESH_SKEW_MS || 120000);
  let cursor = 0;
  let refreshed = 0;
  let reused = 0;
  let failed = 0;
  const failSample = [];

  async function worker() {
    while (cursor < stageUsers.length) {
      const i = cursor;
      cursor += 1;
      const row = stageUsers[i];
      const exp = Number(row.access_token_exp_ms || 0);
      if (exp - Date.now() > skewMs) {
        reused += 1;
        continue;
      }
      let ok = false;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
        if (
          !error &&
          data?.session?.access_token &&
          data?.session?.refresh_token &&
          data?.user?.id === row.user_id
        ) {
          const next = toCanonicalRecord(
            {
              ...row,
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              refreshed_at: new Date().toISOString(),
              refresh_generation: Number(row.refresh_generation || 1) + 1,
            },
            {
              source_run_id: row.source_run_id,
              source_shard: row.source_shard,
              project_ref: row.project_ref,
              run_date_checksum: row.run_date_checksum,
              last_successful_refresh_at: new Date().toISOString(),
            },
          );
          byUser.set(row.user_id, next);
          stageUsers[i] = next;
          refreshed += 1;
          ok = true;
          break;
        }
        const cls = classifyRefreshError(error, error?.status);
        if (cls === "AUTH_RATE_LIMIT") {
          await sleep(jitter(Math.min(30000, 800 * attempt * attempt)));
          continue;
        }
        await sleep(jitter(Math.min(15000, 500 * attempt * attempt)));
        if (attempt === attempts) {
          failed += 1;
          if (failSample.length < 40) {
            failSample.push({
              index: row.index,
              class: cls,
              description_redacted: String(error?.message || "fail")
                .slice(0, 120)
                .replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"),
            });
          }
        }
      }
      if (!ok && failSample.every((f) => f.index !== row.index) && failed > failSample.length) {
        /* already counted */
      }
      if ((refreshed + reused) % 25 === 0) {
        writeCanonicalStore(OUT, [...byUser.values()], { stage_prepare: stage });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, stageUsers.length) }, () => worker()));
  writeCanonicalStore(OUT, [...byUser.values()], { stage_prepare: stage });

  const stagePath = stageSessionsPath(OUT, stage);
  fs.writeFileSync(stagePath, stageUsers.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(
    path.join(OUT, `sessions-${stage}.checkpoint.ndjson`),
    stageUsers.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  fs.copyFileSync(stagePath, path.join(OUT, "sessions.ndjson"));

  const report = {
    phase: "18SCALE",
    stage,
    target,
    refreshed,
    reused_fresh: reused,
    failed,
    fail_sample: failSample,
    SESSION_ROWS: stageUsers.length,
    SESSION_UNIQUE_USER_IDS: new Set(stageUsers.map((r) => r.user_id)).size,
    STAGE_RUNTIME_MANIFEST: failed === 0 ? "PASS" : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, `stage-runtime-prepare-${stage}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.STAGE_RUNTIME_MANIFEST !== "PASS") {
    throw new Error(`PHASE18_STAGE_RUNTIME_PREPARE_FAILED stage=${stage} failed=${failed}`);
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
