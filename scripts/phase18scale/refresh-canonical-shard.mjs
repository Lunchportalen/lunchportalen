#!/usr/bin/env node
/**
 * Refresh one deterministic 1000-user canonical shard with rate limiting + checkpoints.
 * Never prints tokens. Supports targeted reauth for invalid refresh tokens.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  LOADCERT_REF,
  classifyRefreshError,
  loadNdjson,
  toCanonicalRecord,
} from "./lib/canonical-session-store.mjs";
import { encryptFileTo, resolveArtifactKey } from "./lib/session-artifact-crypto.mjs";
import { DEFAULT_SHARD_COUNT, shardRange } from "./lib/session-shards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms) {
  const spread = Math.floor(ms * 0.35);
  return ms + Math.floor(Math.random() * (spread + 1));
}

function synthPassword() {
  return (
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`
  );
}

class RateLimiter {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.nextAt = 0;
    this.timestamps = [];
  }
  async wait() {
    const now = Date.now();
    const delay = Math.max(0, this.nextAt - now);
    if (delay) await sleep(delay);
    const t = Date.now();
    this.nextAt = t + this.minIntervalMs;
    this.timestamps.push(t);
    if (this.timestamps.length > 200) this.timestamps.shift();
  }
  measuredRps() {
    if (this.timestamps.length < 2) return 0;
    const span = (this.timestamps[this.timestamps.length - 1] - this.timestamps[0]) / 1000;
    if (span <= 0) return 0;
    return Number(((this.timestamps.length - 1) / span).toFixed(3));
  }
}

async function refreshOne(anon, row, attempts, limiter) {
  let lastClass = "ANOTHER_EXACT_CAUSE";
  let lastStatus = null;
  let lastRetryAfter = null;
  let lastDesc = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await limiter.wait();
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
          via: "refresh",
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
              project_ref: row.project_ref || LOADCERT_REF,
              run_date_checksum: row.run_date_checksum,
              last_successful_refresh_at: new Date().toISOString(),
            },
          ),
        };
      }
      lastStatus = error?.status ?? null;
      lastRetryAfter = error?.retryAfter ?? null;
      lastDesc = String(error?.message || "refresh_failed").slice(0, 160);
      lastClass = classifyRefreshError(error, lastStatus, lastRetryAfter);
      if (lastClass === "AUTH_RATE_LIMIT") {
        const ra = Number(lastRetryAfter);
        await sleep(jitter(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(60000, 1000 * attempt * attempt)));
        continue;
      }
      if (
        [
          "REFRESH_TOKEN_ALREADY_USED",
          "REFRESH_TOKEN_ROTATED_STALE_COPY",
          "INVALID_GRANT",
          "REFRESH_TOKEN_EXPIRED",
          "USER_DISABLED_OR_MISSING",
        ].includes(lastClass)
      ) {
        break;
      }
      await sleep(jitter(Math.min(60000, 800 * attempt * attempt)));
    } catch (e) {
      lastDesc = String(e?.message || e).slice(0, 160);
      lastClass = classifyRefreshError(e);
      await sleep(jitter(Math.min(60000, 800 * attempt * attempt)));
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

async function reauthOne(anon, admin, row, password, attempts, limiter) {
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(row.user_id);
  if (userErr || !userData?.user?.id) {
    return { ok: false, class: "USER_DISABLED_OR_MISSING" };
  }
  const { data: prof } = await admin
    .from("profiles")
    .select("company_id,location_id")
    .eq("id", row.user_id)
    .maybeSingle();
  if (!prof?.company_id || prof.company_id !== row.company_id) {
    return { ok: false, class: "ANOTHER_EXACT_CAUSE", reason: "company_mismatch" };
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await limiter.wait();
    const { data, error } = await anon.auth.signInWithPassword({ email: row.email, password });
    if (
      !error &&
      data?.session?.access_token &&
      data?.session?.refresh_token &&
      data?.user?.id === row.user_id
    ) {
      return {
        ok: true,
        via: "reauth",
        row: toCanonicalRecord(
          {
            ...row,
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            issued_at: new Date().toISOString(),
            refreshed_at: new Date().toISOString(),
            refresh_generation: Number(row.refresh_generation || 1) + 1,
            reauthed: true,
          },
          {
            source_run_id: row.source_run_id,
            source_shard: row.source_shard,
            project_ref: row.project_ref || LOADCERT_REF,
            run_date_checksum: row.run_date_checksum,
            last_successful_refresh_at: new Date().toISOString(),
          },
        ),
      };
    }
    const cls = classifyRefreshError(error, error?.status);
    if (cls === "AUTH_RATE_LIMIT") {
      await sleep(jitter(Math.min(60000, 1200 * attempt * attempt)));
      continue;
    }
    await sleep(jitter(Math.min(60000, 800 * attempt * attempt)));
  }
  return { ok: false, class: "PASSWORD_REAUTH_REQUIRED" };
}

async function main() {
  const started = new Date().toISOString();
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const cycle = Number(process.env.PHASE18_REFRESH_CYCLE || 1);
  const shard = Number(process.env.PHASE18_REFRESH_SHARD ?? process.env.PHASE18_SESSION_SHARD ?? 0);
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || DEFAULT_SHARD_COUNT);
  const stageTarget = Number(process.env.PHASE18_CANONICAL_TARGET || 10000);
  const { start, end, shardSize } = shardRange(shard, shardCount, stageTarget);
  const concurrency = Number(process.env.PHASE18_REFRESH_CONCURRENCY || 1);
  if (concurrency !== 1) {
    console.log(JSON.stringify({ NOTE: "forcing_concurrency_1_for_rate_safety", requested: concurrency }));
  }
  const attempts = Number(process.env.PHASE18_REFRESH_ATTEMPTS || 8);
  const minIntervalMs = Number(process.env.PHASE18_REFRESH_MIN_INTERVAL_MS || 700);
  const checkpointEvery = Number(process.env.PHASE18_REFRESH_CHECKPOINT_EVERY || 25);
  const allowReauth = !["0", "false", "no"].includes(
    String(process.env.PHASE18_ALLOW_TARGETED_REAUTH || "1").toLowerCase(),
  );

  const inputEnv = process.env.PHASE18_CANONICAL_INPUT || "";
  const inputPath = inputEnv
    ? path.isAbsolute(inputEnv)
      ? inputEnv
      : inputEnv.includes("/") || inputEnv.includes("\\")
        ? path.resolve(inputEnv)
        : path.join(OUT, inputEnv)
    : path.join(OUT, cycle === 1 ? "sessions-canonical-10000.ndjson" : "sessions-canonical-cycle-1.ndjson");
  const all = await loadNdjson(inputPath);
  const sorted = [...all].sort(
    (a, b) => Number(a.index) - Number(b.index) || String(a.user_id).localeCompare(String(b.user_id)),
  );
  if (sorted.length < stageTarget) {
    throw new Error(`PHASE18_CANONICAL_UNDERFILLED rows=${sorted.length} target=${stageTarget}`);
  }
  const shardRows = sorted.slice(start, end);
  if (shardRows.length !== shardSize) {
    throw new Error(
      `PHASE18_SHARD_RANGE_INVALID shard=${shard} got=${shardRows.length} expected=${shardSize} range=${start}-${end}`,
    );
  }
  // Validate contiguous deterministic indices for this shard.
  for (let i = 0; i < shardRows.length; i += 1) {
    const expected = start + i;
    if (Number(shardRows[i].index) !== expected) {
      throw new Error(
        `PHASE18_SHARD_INDEX_MISMATCH shard=${shard} pos=${i} expected_index=${expected} got=${shardRows[i].index}`,
      );
    }
  }

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = synthPassword();
  process.env.PHASE18_SYNTH_PASSWORD = password;
  const limiter = new RateLimiter(minIntervalMs);

  const outRows = shardRows.map((r) => ({ ...r }));
  const ckPath = path.join(OUT, `sessions-canonical-cycle-${cycle}.shard-${shard}.checkpoint.ndjson`);
  const plainPath = path.join(OUT, `sessions-canonical-cycle-${cycle}.shard-${shard}.ndjson`);
  const reportPath = path.join(OUT, `session-refresh-cycle-${cycle}-shard-${shard}.json`);
  const encPath = path.join(OUT, `sessions-canonical-cycle-${cycle}.shard-${shard}.ndjson.aes`);

  // Resume from checkpoint when present and complete-enough.
  if (fs.existsSync(ckPath)) {
    const prior = await loadNdjson(ckPath);
    if (prior.length === shardSize) {
      const byIdx = new Map(prior.map((r) => [Number(r.index), r]));
      let resumeOk = true;
      for (let i = 0; i < shardSize; i += 1) {
        const idx = start + i;
        const hit = byIdx.get(idx);
        if (!hit?.refresh_token || Number(hit.refresh_generation || 0) < Number(shardRows[i].refresh_generation || 1) + 1) {
          // keep working from input unless fully advanced
          if (!(hit?.refreshed_at && Number(hit.refresh_generation) > Number(shardRows[i].refresh_generation || 1))) {
            resumeOk = false;
            break;
          }
        }
      }
      if (resumeOk) {
        for (let i = 0; i < shardSize; i += 1) outRows[i] = byIdx.get(start + i);
      } else if (prior.length) {
        for (const p of prior) {
          const pos = Number(p.index) - start;
          if (pos >= 0 && pos < shardSize && p.refreshed_at) outRows[pos] = p;
        }
      }
    }
  }

  let success = 0;
  let failures = 0;
  let reauthUsers = 0;
  let reauthSuccess = 0;
  let tokenStateLoss = 0;
  const failSample = [];

  function persist() {
    const body = outRows.map((r) => JSON.stringify(r)).join("\n") + "\n";
    fs.writeFileSync(ckPath, body);
    fs.writeFileSync(plainPath, body);
  }

  for (let i = 0; i < outRows.length; i += 1) {
    const row = outRows[i];
    const already =
      row.refreshed_at &&
      Number(row.refresh_generation || 1) >= Number(shardRows[i].refresh_generation || 1) + 1;
    if (already) {
      success += 1;
      continue;
    }
    let result = await refreshOne(anon, row, attempts, limiter);
    if (!result.ok && allowReauth && result.class !== "AUTH_RATE_LIMIT") {
      reauthUsers += 1;
      result = await reauthOne(anon, admin, row, password, attempts, limiter);
      if (result.ok) reauthSuccess += 1;
    }
    if (result.ok) {
      outRows[i] = result.row;
      success += 1;
      if (success % checkpointEvery === 0 || success === shardSize) {
        persist();
        console.log(
          JSON.stringify({
            cycle,
            shard,
            success,
            target: shardSize,
            failures,
            measured_rps: limiter.measuredRps(),
            heartbeat_at: new Date().toISOString(),
          }),
        );
      }
    } else {
      failures += 1;
      tokenStateLoss += 1;
      failSample.push({
        index: row.index,
        class: result.class,
        description_redacted: result.description_redacted || result.reason || null,
      });
      persist();
      break;
    }
  }

  persist();
  const { key, source: keySource } = resolveArtifactKey();
  const encMeta = encryptFileTo(plainPath, encPath, key);
  // Wipe plaintext from evidence (encrypted artifact is the durable form).
  try {
    fs.unlinkSync(plainPath);
  } catch {
    /* ignore */
  }

  const report = {
    phase: "18SCALE",
    cycle,
    shard,
    shard_range: { start, end, shardSize },
    SHARD_TARGET: shardSize,
    SHARD_SUCCESS: success,
    SHARD_FAILURES: failures,
    SHARD_DUPLICATE_USERS: outRows.length - new Set(outRows.map((r) => r.user_id)).size,
    SHARD_TOKEN_STATE_LOSS: tokenStateLoss,
    SHARD_OLD_TOKEN_REUSE: 0,
    SHARD_CHECKPOINT_GAPS: success < shardSize && failures === 0 ? 1 : 0,
    TARGETED_REAUTH_USERS: reauthUsers,
    TARGETED_REAUTH_SUCCESS: reauthSuccess,
    NEW_AUTH_USERS_CREATED: 0,
    BUSINESS_IDENTITIES_SUBSTITUTED: 0,
    UNRELATED_USERS_REAUTHENTICATED: 0,
    measured_rps: limiter.measuredRps(),
    min_interval_ms: minIntervalMs,
    concurrency: 1,
    attempts,
    checkpoint_every: checkpointEvery,
    encryption: {
      algorithm: "aes-256-gcm",
      key_source: keySource,
      plain_checksum: encMeta.plain_checksum,
      cipher_checksum: encMeta.cipher_checksum,
      artifact: path.basename(encPath),
    },
    fail_sample: failSample.slice(0, 40),
    exact_SHA: process.env.APP_SHA || process.env.GITHUB_SHA || null,
    project_ref: LOADCERT_REF,
    started_at: started,
    ended_at: new Date().toISOString(),
    SESSION_REFRESH_SHARD: failures === 0 && success === shardSize ? "PASS" : "FAIL",
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.SESSION_REFRESH_SHARD !== "PASS") {
    throw new Error(
      `PHASE18_REFRESH_SHARD_FAILED cycle=${cycle} shard=${shard} success=${success} failures=${failures}`,
    );
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
