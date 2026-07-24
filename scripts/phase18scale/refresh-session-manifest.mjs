#!/usr/bin/env node
/**
 * Legacy per-stage refresh (nested stage copies — race-prone).
 * Prefer refresh-canonical-sessions.mjs + prepare-stage-runtime-manifest.mjs.
 * Never prints tokens. Fail-closed if refresh fails for any required row.
 *
 * Hardening vs run #35:
 * - checkpoints after every success (reduces TOKEN_ROTATION_STATE_LOSS)
 * - records all failures (not only a 12-row sample)
 * - classifies AUTH_RATE_LIMIT and respects longer backoff
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  resolveSessionStage,
  sessionTargetForStage,
  stageSessionsPath,
  SESSION_STAGE_TARGETS,
} from "./lib/session-stages.mjs";
import { normalizeSessionRow } from "./lib/session-shards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadNdjson(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(normalizeSessionRow(JSON.parse(line)));
  }
  return rows;
}

function jwtExpMs(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(accessToken).split(".")[1], "base64url").toString("utf8"));
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const stagesEnv = String(process.env.PHASE18_SESSION_STAGES || "").trim();
  const stages = stagesEnv
    ? stagesEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : [resolveSessionStage()];

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const concurrency = Number(process.env.PHASE18_REFRESH_CONCURRENCY || 6);
  const skewMs = Number(process.env.PHASE18_REFRESH_SKEW_MS || 120000);
  const summary = { phase: "18SCALE", stages: [], stamped_at: new Date().toISOString() };

  for (const stage of stages) {
    if (!(stage in SESSION_STAGE_TARGETS)) throw new Error(`PHASE18_UNKNOWN_SESSION_STAGE:${stage}`);
    const target = sessionTargetForStage(stage);
    const stagePath = stageSessionsPath(OUT, stage);
    const rows = await loadNdjson(stagePath);
    if (rows.length < target) {
      throw new Error(`PHASE18_REFRESH_MANIFEST_UNDERFILLED stage=${stage} rows=${rows.length} target=${target}`);
    }

    let refreshed = 0;
    let reusedFresh = 0;
    let failed = 0;
    const failSample = [];
    const outRows = rows.map((r) => ({ ...r }));
    let cursor = 0;
    const checkpointEvery = Number(process.env.PHASE18_REFRESH_CHECKPOINT_EVERY || 25);

    async function persistPartial() {
      const body = outRows.map((r) => JSON.stringify(r)).join("\n") + "\n";
      fs.writeFileSync(stagePath, body);
      fs.writeFileSync(path.join(OUT, `sessions-${stage}.checkpoint.ndjson`), body);
    }

    async function worker() {
      while (cursor < rows.length) {
        const i = cursor;
        cursor += 1;
        const row = outRows[i];
        const exp = jwtExpMs(row.access_token);
        if (exp - Date.now() > skewMs) {
          reusedFresh += 1;
          continue;
        }
        if (!row.refresh_token) {
          failed += 1;
          failSample.push({ index: row.index, reason: "missing_refresh_token", class: "ANOTHER_EXACT_CAUSE" });
          continue;
        }
        let ok = false;
        for (let attempt = 1; attempt <= 8; attempt += 1) {
          try {
            const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
            if (
              !error &&
              data?.session?.access_token &&
              data?.session?.refresh_token &&
              data?.user?.id === row.user_id
            ) {
              outRows[i] = {
                ...row,
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                issued_at: row.issued_at || new Date().toISOString(),
                refreshed_at: new Date().toISOString(),
              };
              refreshed += 1;
              ok = true;
              if (refreshed % checkpointEvery === 0) await persistPartial();
              break;
            }
            const reason = error?.message || "refresh_failed";
            const rateLimited = /rate limit/i.test(reason);
            if (attempt === 8) {
              failed += 1;
              failSample.push({
                index: row.index,
                reason: String(reason).slice(0, 120),
                class: rateLimited ? "AUTH_RATE_LIMIT" : "ANOTHER_EXACT_CAUSE",
              });
            } else {
              await sleep(Math.min(rateLimited ? 30000 : 15000, (rateLimited ? 800 : 400) * attempt * attempt));
            }
          } catch (e) {
            if (attempt === 8) {
              failed += 1;
              failSample.push({
                index: row.index,
                reason: String(e?.message || e).slice(0, 120),
                class: "NETWORK_TIMEOUT",
              });
            } else {
              await sleep(Math.min(15000, 400 * attempt * attempt));
            }
          }
        }
        if (!ok) {
          /* counted in failed; row left unchanged for remediation */
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));
    await persistPartial();

    const finalRows = outRows.slice(0, target);
    if (finalRows.length !== target || failed > 0) {
      const report = {
        stage,
        target,
        refreshed,
        reused_fresh: reusedFresh,
        failed,
        rows: finalRows.length,
        fail_sample: failSample,
        SESSION_REFRESH: "FAIL",
        NOTE: "Prefer refresh-canonical-sessions.mjs to avoid nested-stage refresh races",
      };
      fs.writeFileSync(path.join(OUT, `session-refresh-${stage}.json`), JSON.stringify(report, null, 2));
      throw new Error(`PHASE18_SESSION_REFRESH_FAILED stage=${stage} failed=${failed} rows=${finalRows.length}`);
    }
    const report = {
      stage,
      target,
      refreshed,
      reused_fresh: reusedFresh,
      failed: 0,
      rows: finalRows.length,
      SESSION_REFRESH: "PASS",
    };
    summary.stages.push(report);
    fs.writeFileSync(path.join(OUT, `session-refresh-${stage}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }

  const primary = resolveSessionStage();
  const primaryPath = stageSessionsPath(OUT, primary);
  if (fs.existsSync(primaryPath)) fs.copyFileSync(primaryPath, path.join(OUT, "sessions.ndjson"));
  fs.writeFileSync(path.join(OUT, "session-refresh-all.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
