#!/usr/bin/env node
/**
 * Repair only missing deterministic session indices after shard underfill.
 * Never prints tokens/emails/passwords. Idempotent on second run.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";
import { localeForEmployeeIndex } from "./lib/matrix.mjs";
import { sessionTargetForStage, stageSessionsPath } from "./lib/session-stages.mjs";
import {
  DEFAULT_SHARD_COUNT,
  normalizeSessionRow,
  selectStageUniverse,
  shardRange,
  sliceShardUniverse,
} from "./lib/session-shards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const MANIFEST = path.join(OUT, "employee-manifest.ndjson");
const LOADCERT_REF = "arstaxredytrjcmqcwhh";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms) {
  const spread = Math.floor(ms * 0.3);
  return ms + Math.floor(Math.random() * (spread + 1));
}

async function loadNdjson(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) rows.push(normalizeSessionRow(JSON.parse(line)));
  }
  return rows;
}

function isReusable(row) {
  return Boolean(
    row?.user_id &&
      row?.email &&
      row?.company_id &&
      row?.provider_id &&
      typeof row.access_token === "string" &&
      row.access_token.length > 20 &&
      typeof row.refresh_token === "string" &&
      row.refresh_token.length > 10,
  );
}

function packSession(row, session, shard) {
  return {
    email: row.email,
    user_id: row.user_id,
    company_id: row.company_id,
    location_id: row.location_id || null,
    provider_id: row.provider_id || null,
    country: row.country || null,
    package: row.package || null,
    locale: row.locale || null,
    index: row.index,
    access_token: session.access_token,
    refresh_token: session.refresh_token || null,
    issued_at: new Date().toISOString(),
    shard,
    project_ref: LOADCERT_REF,
    repaired: true,
  };
}

async function exportManifestFromCloud(admin, target) {
  fs.mkdirSync(OUT, { recursive: true });
  const companyCache = new Map();
  async function companyMeta(companyId) {
    if (!companyId) return {};
    if (companyCache.has(companyId)) return companyCache.get(companyId);
    const { data, error } = await admin
      .from("companies")
      .select("provider_id,billing_country,contact_email")
      .eq("id", companyId)
      .maybeSingle();
    if (error) throw new Error("company_lookup_failed");
    const meta = data || {};
    companyCache.set(companyId, meta);
    return meta;
  }
  const ws = fs.createWriteStream(MANIFEST);
  let n = 0;
  const pageSize = 1000;
  for (let from = 0; from < 500_000; from += pageSize) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,company_id,location_id")
      .like("email", "p18scale-emp-%@load.lunchportalen.test")
      .order("email", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`profiles_page_failed:${from}`);
    if (!data?.length) break;
    for (const p of data) {
      const m = String(p.email || "").match(/p18scale-emp-(\d+)@/i);
      const index = m ? Number(m[1]) : n;
      const co = await companyMeta(p.company_id);
      let pkg = "BASIS";
      if (/co-luxus/i.test(co.contact_email || "")) pkg = "LUXUS";
      else if (/co-enterprise/i.test(co.contact_email || "")) pkg = "ENTERPRISE";
      ws.write(
        `${JSON.stringify({
          user_id: p.id,
          email: p.email,
          company_id: p.company_id,
          location_id: p.location_id,
          provider_id: co.provider_id || null,
          country: co.billing_country || "NO",
          package: pkg,
          locale: localeForEmployeeIndex(index),
          index,
        })}\n`,
      );
      n += 1;
    }
    if (data.length < pageSize) break;
  }
  await new Promise((resolve, reject) => {
    ws.end(() => resolve());
    ws.on("error", reject);
  });
  if (n < target) throw new Error(`manifest_underfilled:${n}`);
  return n;
}

async function issueOne(anon, admin, row, password, attempts) {
  let lastErr = "no_session";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const pw = await anon.auth.signInWithPassword({ email: row.email, password });
      if (!pw.error && pw.data?.session?.access_token && pw.data?.user?.id === row.user_id) {
        return { session: pw.data.session, attempts: attempt };
      }
      lastErr = pw.error?.message || "password_sign_in_failed";

      if (/invalid login|invalid credentials|email not confirmed/i.test(lastErr) || attempt === 2) {
        const upd = await admin.auth.admin.updateUserById(row.user_id, {
          password,
          email_confirm: true,
        });
        if (upd.error) lastErr = upd.error.message || "password_reset_failed";
      }

      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email });
      if (!link.error && link.data?.properties?.hashed_token) {
        const verified = await anon.auth.verifyOtp({
          type: "email",
          token_hash: link.data.properties.hashed_token,
        });
        if (
          !verified.error &&
          verified.data?.session?.access_token &&
          verified.data?.user?.id === row.user_id
        ) {
          return { session: verified.data.session, attempts: attempt };
        }
        lastErr = verified.error?.message || "magiclink_verify_failed";
      } else {
        lastErr = link.error?.message || lastErr;
      }
    } catch (e) {
      lastErr = String(e?.message || e);
    }
    const rateLimited = /rate limit|too many requests|over_request_rate/i.test(lastErr);
    await sleep(
      jitter(
        rateLimited
          ? Math.min(60000, 2500 * attempt * attempt)
          : Math.min(12000, 400 * attempt * attempt),
      ),
    );
  }
  throw new Error(lastErr);
}

function discoverMissingIndices(stage, shardCount, target, universe) {
  const missing = [];
  for (let shard = 0; shard < shardCount; shard += 1) {
    const range = shardRange(shard, shardCount, target);
    const expected = sliceShardUniverse(universe, shard, shardCount, target);
    const paths = [
      path.join(OUT, `sessions-${stage}.shard-${shard}.ndjson`),
      path.join(OUT, `sessions-${stage}.shard-${shard}.checkpoint.ndjson`),
    ];
    const have = new Map();
    for (const p of paths) {
      if (!fs.existsSync(p)) continue;
      const text = fs.readFileSync(p, "utf8");
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const r = normalizeSessionRow(JSON.parse(line));
        if (isReusable(r)) have.set(Number(r.index), r);
      }
    }
    for (const row of expected) {
      if (!have.has(Number(row.index))) missing.push({ ...row, shard, range });
    }
  }
  return missing;
}

function rewriteShardFiles(stage, shard, shardCount, target, universe, byIndexSessions) {
  const expected = sliceShardUniverse(universe, shard, shardCount, target);
  const rows = [];
  for (const exp of expected) {
    const hit = byIndexSessions.get(Number(exp.index));
    if (!hit || !isReusable(hit)) {
      throw new Error(`SHARD_REWRITE_MISSING index=${exp.index} shard=${shard}`);
    }
    rows.push(
      normalizeSessionRow({
        ...exp,
        ...hit,
        index: exp.index,
        shard,
        project_ref: LOADCERT_REF,
      }),
    );
  }
  const out = path.join(OUT, `sessions-${stage}.shard-${shard}.ndjson`);
  const ck = path.join(OUT, `sessions-${stage}.shard-${shard}.checkpoint.ndjson`);
  fs.writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(ck, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return rows.length;
}

async function main() {
  const ref = String(process.env.PHASE18_LOAD_REF || "").trim();
  if (ref !== LOADCERT_REF) throw new Error(`WRONG_PROJECT:${ref || "empty"}`);

  const { url } = loadPhase18Env();
  const stage = String(process.env.PHASE18_SESSION_STAGE || "ramp-10000").trim();
  const target = sessionTargetForStage(stage);
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || DEFAULT_SHARD_COUNT);
  const attempts = Number(process.env.PHASE18_SESSION_ATTEMPTS || 20);
  const pass = String(process.env.PHASE18_REPAIR_PASS || "1");

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;

  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(MANIFEST) || (await loadNdjson(MANIFEST)).length < target) {
    await exportManifestFromCloud(admin, target);
  }
  const allRows = await loadNdjson(MANIFEST);
  const universe = selectStageUniverse(allRows, target);
  if (universe.length < target) {
    throw new Error(`PHASE18_MANIFEST_TOO_SMALL need=${target} available=${universe.length}`);
  }

  const envIndices = String(process.env.PHASE18_REPAIR_INDICES || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));

  let missing = discoverMissingIndices(stage, shardCount, target, universe);
  if (envIndices.length) {
    const want = new Set(envIndices);
    missing = missing.filter((m) => want.has(Number(m.index)));
    // If discover found none (files already complete) but env lists indices, still target those for idempotent reuse check.
    if (missing.length === 0) {
      for (const idx of envIndices) {
        const row = universe.find((r) => Number(r.index) === idx);
        if (!row) throw new Error(`REPAIR_INDEX_NOT_IN_UNIVERSE:${idx}`);
        const shard = Math.floor(
          universe.findIndex((r) => Number(r.index) === idx) / (target / shardCount),
        );
        missing.push({ ...row, shard });
      }
    }
  }

  if (missing.length === 0) {
    // Still rewrite all shard finals from checkpoints for merge safety.
    const byIndex = new Map();
    for (let shard = 0; shard < shardCount; shard += 1) {
      for (const p of [
        path.join(OUT, `sessions-${stage}.shard-${shard}.ndjson`),
        path.join(OUT, `sessions-${stage}.shard-${shard}.checkpoint.ndjson`),
      ]) {
        for (const r of await loadNdjson(p)) {
          if (isReusable(r)) byIndex.set(Number(r.index), r);
        }
      }
    }
    for (let shard = 0; shard < shardCount; shard += 1) {
      rewriteShardFiles(stage, shard, shardCount, target, universe, byIndex);
    }
    const summary = {
      phase: "18SCALE",
      job: "repair-missing-sessions",
      pass,
      REPAIR_TARGETS: 0,
      REPAIR_SESSIONS_ISSUED: 0,
      REPAIR_REUSED_EXISTING: envIndices.length || 0,
      REPAIR_FAILURES: 0,
      UNRELATED_SESSIONS_REISSUED: 0,
      SUCCESSFUL_SESSIONS_REPLACED: 0,
      SESSION_WRAP: false,
      stamped_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(OUT, `session-repair-${pass}.json`), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Load existing reusable sessions across shards for rewrite.
  const byIndex = new Map();
  for (let shard = 0; shard < shardCount; shard += 1) {
    for (const p of [
      path.join(OUT, `sessions-${stage}.shard-${shard}.ndjson`),
      path.join(OUT, `sessions-${stage}.shard-${shard}.checkpoint.ndjson`),
    ]) {
      for (const r of await loadNdjson(p)) {
        if (isReusable(r)) byIndex.set(Number(r.index), r);
      }
    }
  }

  let issued = 0;
  let reusedExisting = 0;
  let failed = 0;
  const failSample = [];
  const repaired = [];

  // Serialize to avoid Auth rate limits that caused the original underfill.
  for (const row of missing) {
    const existing = byIndex.get(Number(row.index));
    if (existing && isReusable(existing)) {
      reusedExisting += 1;
      repaired.push(existing);
      continue;
    }
    try {
      const { session, attempts: used } = await issueOne(anon, admin, row, password, attempts);
      const packed = packSession(row, session, row.shard);
      byIndex.set(Number(row.index), packed);
      repaired.push(packed);
      issued += 1;
      // Append checkpoint line for crash safety (tokens not logged).
      const ckPath = path.join(OUT, `sessions-${stage}.shard-${row.shard}.checkpoint.ndjson`);
      fs.appendFileSync(ckPath, `${JSON.stringify(packed)}\n`);
      console.log(
        JSON.stringify({
          repaired_index: row.index,
          shard: row.shard,
          attempts_used: used,
          issued_new: issued,
          remaining: missing.length - issued - reusedExisting,
        }),
      );
      await sleep(jitter(1500));
    } catch (e) {
      failed += 1;
      failSample.push({
        index: row.index,
        shard: row.shard,
        reason: String(e?.message || e).slice(0, 160),
      });
    }
  }

  if (failed !== 0) {
    const failReport = {
      phase: "18SCALE",
      job: "repair-missing-sessions",
      pass,
      REPAIR_TARGETS: missing.length,
      REPAIR_SESSIONS_ISSUED: issued,
      REPAIR_FAILURES: failed,
      fail_sample: failSample,
      SESSION_REPAIR: "FAIL",
    };
    fs.writeFileSync(path.join(OUT, `session-repair-${pass}.json`), JSON.stringify(failReport, null, 2));
    console.log(JSON.stringify(failReport, null, 2));
    throw new Error(`SESSION_REPAIR_FAILED failed=${failed}`);
  }

  const touched = new Set(missing.map((m) => m.shard));
  for (let shard = 0; shard < shardCount; shard += 1) {
    // Always rewrite all shards so merge has complete .ndjson files.
    rewriteShardFiles(stage, shard, shardCount, target, universe, byIndex);
  }

  // Build provisional ramp-10000 checkpoint for merge absorb path.
  const all = [];
  for (let shard = 0; shard < shardCount; shard += 1) {
    all.push(...(await loadNdjson(path.join(OUT, `sessions-${stage}.shard-${shard}.ndjson`))));
  }
  const uniq = [];
  const seenU = new Set();
  const seenE = new Set();
  for (const r of all.sort((a, b) => Number(a.index) - Number(b.index))) {
    if (!isReusable(r) || seenU.has(r.user_id) || seenE.has(r.email)) continue;
    seenU.add(r.user_id);
    seenE.add(r.email);
    uniq.push(r);
  }
  fs.writeFileSync(
    path.join(OUT, `sessions-${stage}.checkpoint.ndjson`),
    uniq.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );

  const summary = {
    phase: "18SCALE",
    job: "repair-missing-sessions",
    pass,
    REPAIR_TARGETS: missing.length,
    REPAIR_SESSIONS_ISSUED: issued,
    REPAIR_REUSED_EXISTING: reusedExisting,
    REPAIR_FAILURES: 0,
    UNRELATED_SESSIONS_REISSUED: 0,
    SUCCESSFUL_SESSIONS_REPLACED: 0,
    repaired_indices: missing.map((m) => m.index),
    touched_shards: [...touched].sort((a, b) => a - b),
    SHARD_VALID_SESSIONS: uniq.length,
    SESSION_WRAP: false,
    SESSION_REPAIR: "PASS",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, `session-repair-${pass}.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (uniq.length !== target) {
    throw new Error(`REPAIR_TOTAL_UNDERFILL got=${uniq.length} need=${target}`);
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
