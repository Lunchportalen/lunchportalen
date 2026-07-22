#!/usr/bin/env node
/**
 * Issue one deterministic GoTrue session shard for a stage.
 * Resumes prior checkpoint rows in-range; never fabricates JWTs; never creates users.
 * Never prints tokens/passwords.
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms) {
  const spread = Math.floor(ms * 0.25);
  return ms + Math.floor(Math.random() * (spread + 1));
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

async function exportManifestFromCloud(admin) {
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
  return n;
}

function packSession(row, session) {
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
    shard: Number(process.env.PHASE18_SESSION_SHARD_INDEX),
  };
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

async function issueOne(anon, admin, row, password, attempts) {
  let lastErr = "no_session";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const pw = await anon.auth.signInWithPassword({ email: row.email, password });
      if (!pw.error && pw.data?.session?.access_token && pw.data?.user?.id === row.user_id) {
        return pw.data.session;
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
          return verified.data.session;
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
          ? Math.min(30000, 1500 * attempt * attempt)
          : Math.min(8000, 250 * attempt * attempt),
      ),
    );
  }
  throw new Error(lastErr);
}

async function mapPool(items, limitN, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limitN, items.length) }, () => worker()));
}

async function main() {
  const { url } = loadPhase18Env();
  const stage = String(process.env.PHASE18_SESSION_STAGE || "ramp-10000").trim();
  const target = sessionTargetForStage(stage);
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || DEFAULT_SHARD_COUNT);
  const shardIndex = Number(process.env.PHASE18_SESSION_SHARD_INDEX);
  const range = shardRange(shardIndex, shardCount, target);
  const concurrency = Number(process.env.PHASE18_SESSION_CONCURRENCY || 4);
  const attempts = Number(process.env.PHASE18_SESSION_ATTEMPTS || 8);

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
    const n = await exportManifestFromCloud(admin);
    if (n < target) throw new Error(`manifest_underfilled:${n}`);
  }

  const allRows = await loadNdjson(MANIFEST);
  const universe = selectStageUniverse(allRows, target);
  if (universe.length < target) {
    throw new Error(`PHASE18_MANIFEST_TOO_SMALL need=${target} available=${universe.length}`);
  }
  const shardUsers = sliceShardUniverse(universe, shardIndex, shardCount, target);
  if (shardUsers.length !== range.shardSize) {
    throw new Error(`PHASE18_SHARD_SLICE_MISMATCH got=${shardUsers.length} need=${range.shardSize}`);
  }

  const priorPaths = [
    path.join(OUT, `sessions-${stage}.checkpoint.ndjson`),
    stageSessionsPath(OUT, stage),
    path.join(OUT, `sessions-${stage}.shard-${shardIndex}.ndjson`),
    path.join(OUT, `sessions-${stage}.shard-${shardIndex}.checkpoint.ndjson`),
  ];
  const priorByUser = new Map();
  for (const p of priorPaths) {
    for (const row of await loadNdjson(p)) {
      if (isReusable(row)) priorByUser.set(row.user_id, row);
    }
  }

  const shardCheckpoint = path.join(OUT, `sessions-${stage}.shard-${shardIndex}.checkpoint.ndjson`);
  const shardOut = path.join(OUT, `sessions-${stage}.shard-${shardIndex}.ndjson`);
  const ck = fs.createWriteStream(shardCheckpoint, { flags: "a" });

  const reused = [];
  const need = [];
  for (const row of shardUsers) {
    const hit = priorByUser.get(row.user_id);
    if (hit && hit.email === row.email) {
      reused.push(
        normalizeSessionRow({
          ...row,
          ...hit,
          index: row.index,
          shard: shardIndex,
        }),
      );
    } else {
      need.push(row);
    }
  }

  let issuedNew = 0;
  let failed = 0;
  const failSample = [];
  const issued = [...reused];

  await mapPool(need, concurrency, async (row) => {
    try {
      const session = await issueOne(anon, admin, row, password, attempts);
      const packed = packSession(row, session);
      ck.write(`${JSON.stringify(packed)}\n`);
      issued.push(packed);
      issuedNew += 1;
      if (issuedNew % 25 === 0) {
        console.log(
          JSON.stringify({
            stage,
            shard: shardIndex,
            reused: reused.length,
            issued_new: issuedNew,
            failed,
            shard_target: range.shardSize,
            remaining: Math.max(0, range.shardSize - issued.length),
          }),
        );
      }
    } catch (e) {
      failed += 1;
      if (failSample.length < 12) {
        failSample.push({ index: row.index, reason: String(e?.message || e).slice(0, 120) });
      }
    }
  });

  await new Promise((resolve, reject) => {
    ck.end(() => resolve());
    ck.on("error", reject);
  });

  issued.sort((a, b) => Number(a.index) - Number(b.index));
  const unique = [];
  const seenU = new Set();
  const seenE = new Set();
  for (const r of issued) {
    if (seenU.has(r.user_id) || seenE.has(r.email)) continue;
    if (!isReusable(r)) continue;
    seenU.add(r.user_id);
    seenE.add(r.email);
    unique.push(r);
  }

  if (unique.length !== range.shardSize) {
    const summary = {
      phase: "18SCALE",
      stage,
      shard: shardIndex,
      shard_target: range.shardSize,
      rows: unique.length,
      reused: reused.length,
      issued_new: issuedNew,
      failed,
      fail_sample: failSample,
      SESSION_SHARD: "FAIL",
    };
    fs.writeFileSync(
      path.join(OUT, `issue-auth-sessions-${stage}-shard-${shardIndex}.json`),
      JSON.stringify(summary, null, 2),
    );
    throw new Error(
      `PHASE18_SESSION_SHARD_UNDERFILLED shard=${shardIndex} got=${unique.length} need=${range.shardSize} failed=${failed}`,
    );
  }

  fs.writeFileSync(shardOut, unique.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const summary = {
    phase: "18SCALE",
    stage,
    shard: shardIndex,
    shard_count: shardCount,
    range: { start: range.start, end: range.end },
    rows: unique.length,
    unique_users: unique.length,
    unique_emails: new Set(unique.map((r) => r.email)).size,
    reused: reused.length,
    issued_new: issuedNew,
    failed,
    fail_sample: failSample,
    SESSION_SHARD: "PASS",
    SESSION_WRAP: false,
  };
  fs.writeFileSync(
    path.join(OUT, `issue-auth-sessions-${stage}-shard-${shardIndex}.json`),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
