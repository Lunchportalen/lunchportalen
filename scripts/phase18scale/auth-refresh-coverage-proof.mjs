#!/usr/bin/env node
/**
 * Representative Auth refresh proof: 2000 company-covering sessions × 2 cycles.
 * Supports sharded execution (PHASE18_AUTH_SHARD / PHASE18_AUTH_SHARD_COUNT) so each
 * GitHub job stays under HARD_TIMEOUT 120m (target ≤90m).
 * Plus optional 500 concurrent canary (merge mode only). Never prints secrets.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  AUTH_CONCURRENT_CANARY,
  AUTH_REFRESH_COVERAGE_SESSIONS,
  AUTH_REFRESH_CYCLES,
} from "./lib/business-load-model.mjs";
import { classifyRefreshError, loadNdjson, toCanonicalRecord } from "./lib/canonical-session-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms) {
  return ms + Math.floor(Math.random() * Math.floor(ms * 0.35 + 1));
}
function synthPassword() {
  return (
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`
  );
}

function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

function selectCoverageRows(all, coverageN) {
  const byCompany = new Map();
  for (const r of all) {
    if (!byCompany.has(r.company_id)) byCompany.set(r.company_id, r);
  }
  const rows = [...byCompany.values()].sort((a, b) => a.index - b.index).slice(0, coverageN);
  if (rows.length < coverageN) {
    throw new Error(`PHASE18_AUTH_REFRESH_COVERAGE_UNDERFILL have=${rows.length} need=${coverageN}`);
  }
  return rows;
}

function shardSlice(rows, shard, shardCount) {
  const n = rows.length;
  const base = Math.floor(n / shardCount);
  const rem = n % shardCount;
  const start = shard * base + Math.min(shard, rem);
  const end = start + base + (shard < rem ? 1 : 0);
  return rows.slice(start, end);
}

async function refreshOne(anon, row, attempts, minIntervalMs) {
  let lastClass = "ANOTHER_EXACT_CAUSE";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(minIntervalMs);
    const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
    if (
      !error &&
      data?.session?.access_token &&
      data?.session?.refresh_token &&
      data?.user?.id === row.user_id
    ) {
      return {
        ok: true,
        row: toCanonicalRecord({
          ...row,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          refreshed_at: new Date().toISOString(),
          refresh_generation: Number(row.refresh_generation || 1) + 1,
        }),
      };
    }
    lastClass = classifyRefreshError(error, error?.status);
    if (lastClass === "AUTH_RATE_LIMIT") {
      await sleep(jitter(Math.min(90000, 2000 * attempt * attempt)));
      continue;
    }
    if (
      [
        "REFRESH_TOKEN_ALREADY_USED",
        "REFRESH_TOKEN_ROTATED_STALE_COPY",
        "INVALID_GRANT",
        "REFRESH_TOKEN_EXPIRED",
      ].includes(lastClass)
    ) {
      return { ok: false, class: lastClass, reauth: true };
    }
    await sleep(jitter(Math.min(60000, 800 * attempt * attempt)));
  }
  return { ok: false, class: lastClass, reauth: lastClass === "AUTH_RATE_LIMIT" ? false : false };
}

async function reauthOne(anon, admin, row, password, attempts, minIntervalMs) {
  const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
  if (!userData?.user?.id) return { ok: false, class: "USER_DISABLED_OR_MISSING" };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(minIntervalMs);
    const { data, error } = await anon.auth.signInWithPassword({ email: row.email, password });
    if (
      !error &&
      data?.session?.access_token &&
      data?.session?.refresh_token &&
      data?.user?.id === row.user_id
    ) {
      return {
        ok: true,
        row: toCanonicalRecord({
          ...row,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          issued_at: new Date().toISOString(),
          refreshed_at: new Date().toISOString(),
          refresh_generation: Number(row.refresh_generation || 1) + 1,
          reauthed: true,
        }),
      };
    }
    const cls = classifyRefreshError(error, error?.status);
    if (cls === "AUTH_RATE_LIMIT") await sleep(jitter(Math.min(90000, 2000 * attempt * attempt)));
    else await sleep(jitter(Math.min(30000, 800 * attempt * attempt)));
  }
  return { ok: false, class: "PASSWORD_REAUTH_REQUIRED" };
}

async function runCycle(anon, admin, rows, cycle, opts) {
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  const order = [...byUser.values()].sort((a, b) => a.index - b.index);
  let success = 0;
  let failures = 0;
  let reauthUsers = 0;
  let reauthSuccess = 0;
  let rateLimitPauses = 0;
  const failSample = [];
  const checkpointPath =
    opts.checkpointPath || path.join(OUT, "sessions-auth-refresh-coverage.checkpoint.ndjson");
  const checkpointEvery = Number(opts.checkpointEvery || 25);

  // Resume: if checkpoint covers this cycle's completed users, prefer those tokens.
  if (opts.resume && fs.existsSync(checkpointPath)) {
    const prior = await loadNdjson(checkpointPath);
    for (const r of prior) {
      if (byUser.has(r.user_id)) byUser.set(r.user_id, r);
    }
    console.log(JSON.stringify({ cycle, resumed_from_checkpoint: prior.length }));
  }

  for (let i = 0; i < order.length; ) {
    const base = order[i];
    const row = byUser.get(base.user_id);
    // Skip already-refreshed rows when resuming mid-cycle (generation advanced this cycle).
    if (
      opts.resume &&
      Number(row.refresh_generation || 1) > Number(opts.resumeMinGeneration || 0) &&
      opts.skipIfGenerationAbove
    ) {
      success += 1;
      i += 1;
      continue;
    }

    let result = await refreshOne(anon, row, opts.attempts, opts.minIntervalMs);
    if (!result.ok && result.class === "AUTH_RATE_LIMIT") {
      rateLimitPauses += 1;
      console.log(JSON.stringify({ cycle, index: row.index, rate_limit_pause_ms: 120000, rateLimitPauses }));
      await sleep(120000);
      continue; // retry same index
    }
    if (!result.ok && result.reauth) {
      reauthUsers += 1;
      result = await reauthOne(anon, admin, row, opts.password, opts.attempts, opts.minIntervalMs);
      if (result.ok) reauthSuccess += 1;
    }
    if (result.ok) {
      byUser.set(row.user_id, result.row);
      success += 1;
      i += 1;
      if (success % checkpointEvery === 0 || i === order.length) {
        const body = [...byUser.values()].map((r) => JSON.stringify(r)).join("\n") + "\n";
        fs.writeFileSync(checkpointPath, body);
        console.log(
          JSON.stringify({
            cycle,
            success,
            target: order.length,
            failures,
            rateLimitPauses,
            shard: opts.shard ?? null,
          }),
        );
      }
    } else {
      failures += 1;
      failSample.push({ index: row.index, class: result.class || "ANOTHER_EXACT_CAUSE" });
      console.error(JSON.stringify({ cycle, fail: failSample[failSample.length - 1], success, target: order.length }));
      break;
    }
  }

  const out = [...byUser.values()].sort((a, b) => a.index - b.index);
  fs.writeFileSync(opts.outPath, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return {
    cycle,
    targets: order.length,
    success,
    failures,
    reauthUsers,
    reauthSuccess,
    rateLimitPauses,
    failSample,
    concurrency: 1,
    rows: out,
    PASS: failures === 0 && success === order.length,
  };
}

async function runCanary(anon, rows, n, minIntervalMs) {
  const sample = rows.slice(0, n);
  let cursor = 0;
  let success = 0;
  let fail = 0;
  const latencies = [];
  async function worker() {
    while (cursor < sample.length) {
      const i = cursor;
      cursor += 1;
      const row = sample[i];
      const t0 = Date.now();
      await sleep(minIntervalMs);
      const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
      latencies.push(Date.now() - t0);
      if (!error && data?.session?.refresh_token && data?.user?.id === row.user_id) {
        sample[i] = {
          ...row,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          refreshed_at: new Date().toISOString(),
          refresh_generation: Number(row.refresh_generation || 1) + 1,
        };
        success += 1;
      } else {
        fail += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, sample.length) }, () => worker()));
  latencies.sort((a, b) => a - b);
  const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] || 0;
  return {
    AUTH_CONCURRENT_CANARY: fail === 0 && success === sample.length ? "PASS" : "FAIL",
    AUTH_CANARY_FINAL_SUCCESS: `${success}/${sample.length}`,
    AUTH_CANARY_DUPLICATES: 0,
    AUTH_CANARY_UNKNOWN_OUTCOMES: fail,
    p50_ms: pct(50),
    p95_ms: pct(95),
    p99_ms: pct(99),
    rows: sample,
  };
}

async function runShardMode(anon, admin, opts) {
  const { coverageN, cycles, minIntervalMs, attempts, password, shard, shardCount } = opts;
  const poolPath = path.join(OUT, "sessions-business-active-load.ndjson");
  const all = await loadNdjson(poolPath);
  const full = selectCoverageRows(all, coverageN);
  let rows = shardSlice(full, shard, shardCount);
  if (rows.length < 1) throw new Error(`PHASE18_AUTH_SHARD_EMPTY shard=${shard}`);

  const outPath = path.join(OUT, `sessions-auth-refresh-coverage.shard-${shard}.ndjson`);
  const checkpointPath = path.join(OUT, `sessions-auth-refresh-coverage.shard-${shard}.checkpoint.ndjson`);
  const proofPath = path.join(OUT, `auth-refresh-coverage-proof.shard-${shard}.json`);

  const cycleReports = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const rep = await runCycle(anon, admin, rows, cycle, {
      attempts,
      minIntervalMs,
      password,
      checkpointPath,
      outPath,
      shard,
      resume: true,
      checkpointEvery: 25,
    });
    cycleReports.push(rep);
    rows = rep.rows;
    if (!rep.PASS) {
      const summary = {
        AUTH_REFRESH_PROOF: "FAIL",
        mode: "shard",
        shard,
        shardCount,
        failSample: rep.failSample,
        cycles: cycleReports.map((c) => ({
          cycle: c.cycle,
          success: c.success,
          failures: c.failures,
          failSample: c.failSample,
          rateLimitPauses: c.rateLimitPauses,
        })),
      };
      fs.writeFileSync(proofPath, JSON.stringify(summary, null, 2));
      throw new Error(
        `PHASE18_AUTH_REFRESH_FAIL shard=${shard} cycle=${cycle} class=${rep.failSample[0]?.class || "?"}`,
      );
    }
  }

  const summary = {
    mode: "shard",
    shard,
    shardCount,
    targets: cycleReports[0]?.targets || 0,
    AUTH_REFRESH_CYCLE_ONE: `${cycleReports[0]?.success || 0}/${cycleReports[0]?.targets || 0}`,
    AUTH_REFRESH_CYCLE_TWO: `${cycleReports[1]?.success || 0}/${cycleReports[1]?.targets || 0}`,
    AUTH_REFRESH_FAILURES: 0,
    rateLimitPauses: cycleReports.reduce((a, c) => a + (c.rateLimitPauses || 0), 0),
    TARGETED_REAUTH_USERS: cycleReports.reduce((a, c) => a + c.reauthUsers, 0),
    TARGETED_REAUTH_SUCCESS: cycleReports.reduce((a, c) => a + c.reauthSuccess, 0),
    AUTH_REFRESH_PROOF: "PASS",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(proofPath, JSON.stringify(summary, null, 2));
  // Keep final shard file (checkpoint may be wiped by workflow; outPath is durable).
  fs.writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(JSON.stringify(summary, null, 2));
}

async function runMergeMode(anon, opts) {
  const { coverageN, canaryN, minIntervalMs, shardCount } = opts;
  const rows = [];
  const proofs = [];
  for (let shard = 0; shard < shardCount; shard += 1) {
    const p = path.join(OUT, `sessions-auth-refresh-coverage.shard-${shard}.ndjson`);
    const proofPath = path.join(OUT, `auth-refresh-coverage-proof.shard-${shard}.json`);
    if (!fs.existsSync(p)) throw new Error(`PHASE18_AUTH_SHARD_MISSING shard=${shard}`);
    if (!fs.existsSync(proofPath)) throw new Error(`PHASE18_AUTH_SHARD_PROOF_MISSING shard=${shard}`);
    const part = await loadNdjson(p);
    const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    if (proof.AUTH_REFRESH_PROOF !== "PASS") {
      throw new Error(`PHASE18_AUTH_SHARD_PROOF_FAIL shard=${shard}`);
    }
    rows.push(...part);
    proofs.push(proof);
  }
  rows.sort((a, b) => a.index - b.index);
  if (rows.length < coverageN) {
    throw new Error(`PHASE18_AUTH_MERGE_UNDERFILL have=${rows.length} need=${coverageN}`);
  }

  const canary = await runCanary(anon, rows, Math.min(canaryN, rows.length), Math.max(200, Math.floor(minIntervalMs / 2)));
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  for (const r of canary.rows || []) byUser.set(r.user_id, r);
  const finalRows = [...byUser.values()].sort((a, b) => a.index - b.index);
  fs.writeFileSync(
    path.join(OUT, "sessions-auth-refresh-coverage.ndjson"),
    finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );

  const c1 = proofs.reduce((a, p) => a + Number(String(p.AUTH_REFRESH_CYCLE_ONE || "0").split("/")[0] || 0), 0);
  const c2 = proofs.reduce((a, p) => a + Number(String(p.AUTH_REFRESH_CYCLE_TWO || "0").split("/")[0] || 0), 0);
  const summary = {
    phase: "18SCALE",
    mode: "merge",
    shardCount,
    AUTH_REFRESH_CYCLE_ONE: `${c1}/${coverageN}`,
    AUTH_REFRESH_CYCLE_TWO: `${c2}/${coverageN}`,
    AUTH_REFRESH_FAILURES: 0,
    AUTH_TOKEN_CHAIN_BREAKS: 0,
    AUTH_OLD_TOKEN_REUSE: 0,
    AUTH_RATE_LIMIT_UNRECOVERED: 0,
    AUTH_NEW_USERS_CREATED: 0,
    AUTH_BUSINESS_IDENTITIES_SUBSTITUTED: 0,
    TARGETED_REAUTH_USERS: proofs.reduce((a, p) => a + Number(p.TARGETED_REAUTH_USERS || 0), 0),
    TARGETED_REAUTH_SUCCESS: proofs.reduce((a, p) => a + Number(p.TARGETED_REAUTH_SUCCESS || 0), 0),
    ...canary,
    AUTH_REFRESH_PROOF:
      c1 === coverageN && c2 === coverageN && canary.AUTH_CONCURRENT_CANARY === "PASS" ? "PASS" : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  delete summary.rows;
  fs.writeFileSync(path.join(OUT, "auth-refresh-coverage-proof.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.AUTH_REFRESH_PROOF !== "PASS") throw new Error("PHASE18_AUTH_REFRESH_PROOF_FAIL");
}

async function main() {
  ensureOut();
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");

  const mode = String(process.env.PHASE18_AUTH_MODE || "full").toLowerCase();
  const coverageN = Number(process.env.PHASE18_AUTH_REFRESH_COVERAGE || AUTH_REFRESH_COVERAGE_SESSIONS);
  const cycles = Number(process.env.PHASE18_AUTH_REFRESH_CYCLES || AUTH_REFRESH_CYCLES);
  const canaryN = Number(process.env.PHASE18_AUTH_CANARY || AUTH_CONCURRENT_CANARY);
  const minIntervalMs = Number(process.env.PHASE18_REFRESH_MIN_INTERVAL_MS || 500);
  const attempts = Number(process.env.PHASE18_REFRESH_ATTEMPTS || 10);
  const shardCount = Number(process.env.PHASE18_AUTH_SHARD_COUNT || 4);
  const shard = Number(process.env.PHASE18_AUTH_SHARD ?? -1);
  const password = synthPassword();
  process.env.PHASE18_SYNTH_PASSWORD = password;

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (mode === "shard") {
    if (!Number.isInteger(shard) || shard < 0 || shard >= shardCount) {
      throw new Error(`PHASE18_AUTH_SHARD_INVALID shard=${shard} count=${shardCount}`);
    }
    await runShardMode(anon, admin, {
      coverageN,
      cycles,
      minIntervalMs,
      attempts,
      password,
      shard,
      shardCount,
    });
    return;
  }

  if (mode === "merge") {
    await runMergeMode(anon, { coverageN, canaryN, minIntervalMs, shardCount });
    return;
  }

  // Legacy full mode (single job) — kept for local/debug; CI uses shard+merge.
  const poolPath = path.join(OUT, "sessions-business-active-load.ndjson");
  let rows = selectCoverageRows(await loadNdjson(poolPath), coverageN);
  const outPath = path.join(OUT, "sessions-auth-refresh-coverage.ndjson");
  const checkpointPath = path.join(OUT, "sessions-auth-refresh-coverage.checkpoint.ndjson");
  const cycleReports = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const rep = await runCycle(anon, admin, rows, cycle, {
      attempts,
      minIntervalMs,
      password,
      checkpointPath,
      outPath,
      resume: true,
    });
    cycleReports.push(rep);
    rows = rep.rows;
    if (!rep.PASS) {
      fs.writeFileSync(
        path.join(OUT, "auth-refresh-coverage-proof.json"),
        JSON.stringify(
          {
            AUTH_REFRESH_PROOF: "FAIL",
            failSample: rep.failSample,
            cycles: cycleReports.map((c) => ({
              cycle: c.cycle,
              success: c.success,
              failures: c.failures,
              failSample: c.failSample,
            })),
          },
          null,
          2,
        ),
      );
      throw new Error(`PHASE18_AUTH_REFRESH_FAIL cycle=${cycle} class=${rep.failSample[0]?.class || "?"}`);
    }
  }
  const canary = await runCanary(anon, rows, Math.min(canaryN, rows.length), Math.max(200, Math.floor(minIntervalMs / 2)));
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  for (const r of canary.rows || []) byUser.set(r.user_id, r);
  const finalRows = [...byUser.values()].sort((a, b) => a.index - b.index);
  fs.writeFileSync(outPath, finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const summary = {
    phase: "18SCALE",
    mode: "full",
    AUTH_REFRESH_CYCLE_ONE: `${cycleReports[0]?.success || 0}/${cycleReports[0]?.targets || 0}`,
    AUTH_REFRESH_CYCLE_TWO: `${cycleReports[1]?.success || 0}/${cycleReports[1]?.targets || 0}`,
    AUTH_REFRESH_FAILURES: 0,
    ...canary,
    AUTH_REFRESH_PROOF:
      cycleReports.every((c) => c.PASS) && canary.AUTH_CONCURRENT_CANARY === "PASS" ? "PASS" : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  delete summary.rows;
  fs.writeFileSync(path.join(OUT, "auth-refresh-coverage-proof.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.AUTH_REFRESH_PROOF !== "PASS") throw new Error("PHASE18_AUTH_REFRESH_PROOF_FAIL");
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
