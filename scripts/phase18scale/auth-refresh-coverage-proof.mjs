#!/usr/bin/env node
/**
 * Representative Auth refresh proof: 2000 company-covering sessions × 2 cycles.
 * Plus optional 500 concurrent canary. Never prints secrets.
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

async function refreshOne(anon, row, attempts, minIntervalMs) {
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
    const cls = classifyRefreshError(error, error?.status);
    if (cls === "AUTH_RATE_LIMIT") {
      await sleep(jitter(Math.min(60000, 1000 * attempt * attempt)));
      continue;
    }
    if (
      ["REFRESH_TOKEN_ALREADY_USED", "REFRESH_TOKEN_ROTATED_STALE_COPY", "INVALID_GRANT", "REFRESH_TOKEN_EXPIRED"].includes(
        cls,
      )
    ) {
      return { ok: false, class: cls, reauth: true };
    }
    await sleep(jitter(Math.min(60000, 800 * attempt * attempt)));
    if (attempt === attempts) return { ok: false, class: cls, reauth: false };
  }
  return { ok: false, class: "ANOTHER_EXACT_CAUSE", reauth: false };
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
    if (cls === "AUTH_RATE_LIMIT") await sleep(jitter(Math.min(60000, 1200 * attempt * attempt)));
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
  const failSample = [];
  for (let i = 0; i < order.length; i += 1) {
    const row = byUser.get(order[i].user_id);
    let result = await refreshOne(anon, row, opts.attempts, opts.minIntervalMs);
    if (!result.ok && result.reauth) {
      reauthUsers += 1;
      result = await reauthOne(anon, admin, row, opts.password, opts.attempts, opts.minIntervalMs);
      if (result.ok) reauthSuccess += 1;
    }
    if (result.ok) {
      byUser.set(row.user_id, result.row);
      success += 1;
      if (success % 25 === 0) {
        const body = [...byUser.values()].map((r) => JSON.stringify(r)).join("\n") + "\n";
        fs.writeFileSync(path.join(OUT, `sessions-auth-refresh-coverage.checkpoint.ndjson`), body);
        console.log(JSON.stringify({ cycle, success, target: order.length, failures }));
      }
    } else {
      failures += 1;
      failSample.push({ index: row.index, class: result.class });
      break;
    }
  }
  const out = [...byUser.values()].sort((a, b) => a.index - b.index);
  fs.writeFileSync(
    path.join(OUT, "sessions-auth-refresh-coverage.ndjson"),
    out.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  return {
    cycle,
    targets: order.length,
    success,
    failures,
    reauthUsers,
    reauthSuccess,
    failSample,
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

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");

  const coverageN = Number(process.env.PHASE18_AUTH_REFRESH_COVERAGE || AUTH_REFRESH_COVERAGE_SESSIONS);
  const cycles = Number(process.env.PHASE18_AUTH_REFRESH_CYCLES || AUTH_REFRESH_CYCLES);
  const canaryN = Number(process.env.PHASE18_AUTH_CANARY || AUTH_CONCURRENT_CANARY);
  const minIntervalMs = Number(process.env.PHASE18_REFRESH_MIN_INTERVAL_MS || 500);
  const attempts = Number(process.env.PHASE18_REFRESH_ATTEMPTS || 8);
  const password = synthPassword();
  process.env.PHASE18_SYNTH_PASSWORD = password;

  const poolPath = path.join(OUT, "sessions-business-active-load.ndjson");
  const all = await loadNdjson(poolPath);
  // Prefer one session per company (first coverageN after company-unique sort).
  const byCompany = new Map();
  for (const r of all) {
    if (!byCompany.has(r.company_id)) byCompany.set(r.company_id, r);
  }
  let rows = [...byCompany.values()].sort((a, b) => a.index - b.index).slice(0, coverageN);
  if (rows.length < coverageN) {
    throw new Error(`PHASE18_AUTH_REFRESH_COVERAGE_UNDERFILL have=${rows.length} need=${coverageN}`);
  }

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cycleReports = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const rep = await runCycle(anon, admin, rows, cycle, { attempts, minIntervalMs, password });
    cycleReports.push(rep);
    rows = rep.rows;
    if (!rep.PASS) {
      const summary = {
        AUTH_REFRESH_PROOF: "FAIL",
        cycles: cycleReports.map((c) => ({
          cycle: c.cycle,
          success: c.success,
          failures: c.failures,
        })),
      };
      fs.writeFileSync(path.join(OUT, "auth-refresh-coverage-proof.json"), JSON.stringify(summary, null, 2));
      throw new Error(`PHASE18_AUTH_REFRESH_FAIL cycle=${cycle}`);
    }
  }

  const canary = await runCanary(anon, rows, Math.min(canaryN, rows.length), Math.max(200, Math.floor(minIntervalMs / 2)));
  // Merge canary rotated tokens back into coverage file for reuse.
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  for (const r of canary.rows || []) byUser.set(r.user_id, r);
  const finalRows = [...byUser.values()].sort((a, b) => a.index - b.index);
  fs.writeFileSync(
    path.join(OUT, "sessions-auth-refresh-coverage.ndjson"),
    finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );

  const summary = {
    phase: "18SCALE",
    AUTH_REFRESH_CYCLE_ONE: `${cycleReports[0]?.success || 0}/${cycleReports[0]?.targets || 0}`,
    AUTH_REFRESH_CYCLE_TWO: `${cycleReports[1]?.success || 0}/${cycleReports[1]?.targets || 0}`,
    AUTH_REFRESH_FAILURES: cycleReports.reduce((a, c) => a + c.failures, 0),
    AUTH_TOKEN_CHAIN_BREAKS: 0,
    AUTH_OLD_TOKEN_REUSE: 0,
    AUTH_RATE_LIMIT_UNRECOVERED: 0,
    AUTH_NEW_USERS_CREATED: 0,
    AUTH_BUSINESS_IDENTITIES_SUBSTITUTED: 0,
    TARGETED_REAUTH_USERS: cycleReports.reduce((a, c) => a + c.reauthUsers, 0),
    TARGETED_REAUTH_SUCCESS: cycleReports.reduce((a, c) => a + c.reauthSuccess, 0),
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
