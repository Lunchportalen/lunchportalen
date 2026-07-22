#!/usr/bin/env node
/**
 * Refresh expired access tokens using real GoTrue refresh tokens.
 * Never prints tokens. Fail-closed if refresh fails for any required row.
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
    const outRows = new Array(rows.length);
    let cursor = 0;

    async function worker() {
      while (cursor < rows.length) {
        const i = cursor;
        cursor += 1;
        const row = rows[i];
        const exp = jwtExpMs(row.access_token);
        if (exp - Date.now() > skewMs) {
          outRows[i] = row;
          reusedFresh += 1;
          continue;
        }
        if (!row.refresh_token) {
          failed += 1;
          if (failSample.length < 12) failSample.push({ index: row.index, reason: "missing_refresh_token" });
          continue;
        }
        let ok = false;
        for (let attempt = 1; attempt <= 5; attempt += 1) {
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
                issued_at: new Date().toISOString(),
                refreshed_at: new Date().toISOString(),
              };
              refreshed += 1;
              ok = true;
              break;
            }
            const reason = error?.message || "refresh_failed";
            if (attempt === 5) {
              failed += 1;
              if (failSample.length < 12) failSample.push({ index: row.index, reason: String(reason).slice(0, 120) });
            } else {
              await sleep(Math.min(15000, 400 * attempt * attempt));
            }
          } catch (e) {
            if (attempt === 5) {
              failed += 1;
              if (failSample.length < 12) {
                failSample.push({ index: row.index, reason: String(e?.message || e).slice(0, 120) });
              }
            } else {
              await sleep(Math.min(15000, 400 * attempt * attempt));
            }
          }
        }
        if (!ok && !outRows[i]) {
          /* counted in failed */
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));

    const finalRows = outRows.filter(Boolean).slice(0, target);
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
      };
      fs.writeFileSync(path.join(OUT, `session-refresh-${stage}.json`), JSON.stringify(report, null, 2));
      throw new Error(`PHASE18_SESSION_REFRESH_FAILED stage=${stage} failed=${failed} rows=${finalRows.length}`);
    }

    fs.writeFileSync(stagePath, finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    fs.writeFileSync(
      path.join(OUT, `sessions-${stage}.checkpoint.ndjson`),
      finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n",
    );
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
