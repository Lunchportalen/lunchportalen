#!/usr/bin/env node
/**
 * Issue GoTrue employee sessions for Phase 18SCALE stages.
 *
 * - Uses existing synthetic Auth users only (never creates users).
 * - Deterministic selection by employee index.
 * - Paginated manifest export (no silent 1000-row truncation).
 * - Bounded concurrency + retries + checkpoint resume.
 * - Stage-sized unique pools (no coverage wrap that underfills smoke-100).
 * - Never prints tokens/passwords.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";
import { localeForEmployeeIndex } from "./lib/matrix.mjs";
import {
  SESSION_STAGE_TARGETS,
  resolveSessionStage,
  sessionTargetForStage,
  stageSessionsPath,
} from "./lib/session-stages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const MANIFEST = path.join(OUT, "employee-manifest.ndjson");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadManifestRows(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
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
    if (error) throw new Error(`company_lookup_failed`);
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
  console.log(JSON.stringify({ manifest_exported_from_cloud: n }));
  return n;
}

function selectDeterministicUnique(rows, target) {
  const byIndex = [...rows]
    .filter((r) => r?.user_id && r?.email && r?.company_id && r?.location_id)
    .sort((a, b) => Number(a.index) - Number(b.index) || String(a.email).localeCompare(String(b.email)));
  const seenUsers = new Set();
  const seenEmails = new Set();
  const picked = [];
  for (const r of byIndex) {
    if (seenUsers.has(r.user_id) || seenEmails.has(r.email)) continue;
    seenUsers.add(r.user_id);
    seenEmails.add(r.email);
    picked.push(r);
    if (picked.length >= target) break;
  }
  return picked;
}

function loadCheckpoint(checkpointPath) {
  const map = new Map();
  if (!fs.existsSync(checkpointPath)) return map;
  const lines = fs.readFileSync(checkpointPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row?.user_id && row?.email && row?.access_token) map.set(row.user_id, row);
    } catch {
      /* skip corrupt */
    }
  }
  return map;
}

function redactSession(row) {
  return {
    email: row.email,
    user_id: row.user_id,
    company_id: row.company_id,
    location_id: row.location_id || null,
    provider_id: row.provider_id || null,
    country: row.country || null,
    package: row.package || null,
    locale: row.locale || null,
    access_token: row.access_token,
    refresh_token: row.refresh_token || null,
    issued_at: row.issued_at || new Date().toISOString(),
  };
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

      // Ensure password on existing user only (never create).
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
      rateLimited
        ? Math.min(30000, 1500 * attempt * attempt)
        : Math.min(8000, 250 * attempt * attempt),
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

async function issueStage({
  anon,
  admin,
  password,
  allRows,
  stage,
  target,
  concurrency,
  attempts,
}) {
  const stagePath = stageSessionsPath(OUT, stage);
  const checkpointPath = path.join(OUT, `sessions-${stage}.checkpoint.ndjson`);
  // Overselect candidates so individual GoTrue failures cannot underfill the stage.
  const candidateN = Math.min(
    allRows.length,
    Math.max(target * 5, target + 200),
  );
  const candidates = selectDeterministicUnique(allRows, candidateN);
  if (candidates.length < target) {
    throw new Error(
      `PHASE18_MANIFEST_TOO_SMALL stage=${stage} need=${target} available_unique=${candidates.length}`,
    );
  }

  const checkpoint = loadCheckpoint(checkpointPath);
  const issuedRows = [];
  const acceptedUsers = new Set();
  for (const row of candidates) {
    const hit = checkpoint.get(row.user_id);
    if (hit?.access_token && hit.email === row.email && hit.company_id) {
      const packed = redactSession({ ...row, ...hit });
      if (!acceptedUsers.has(packed.user_id)) {
        acceptedUsers.add(packed.user_id);
        issuedRows.push(packed);
      }
    }
    if (issuedRows.length >= target) break;
  }

  let failed = 0;
  const failSample = [];
  const ck = fs.createWriteStream(checkpointPath, { flags: checkpoint.size ? "a" : "w" });

  // Issue remaining candidates in deterministic order until stage target is filled.
  const pending = candidates.filter((r) => !acceptedUsers.has(r.user_id));
  let cursor = 0;
  while (issuedRows.length < target && cursor < pending.length) {
    const batchSize = Math.min(concurrency, pending.length - cursor, target - issuedRows.length + concurrency);
    const batch = pending.slice(cursor, cursor + batchSize);
    cursor += batch.length;
    await mapPool(batch, concurrency, async (row) => {
      if (issuedRows.length >= target) return;
      try {
        const session = await issueOne(anon, admin, row, password, attempts);
        const packed = redactSession({
          ...row,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          issued_at: new Date().toISOString(),
        });
        ck.write(`${JSON.stringify(packed)}\n`);
        if (!acceptedUsers.has(packed.user_id) && issuedRows.length < target) {
          acceptedUsers.add(packed.user_id);
          issuedRows.push(packed);
        }
        if (issuedRows.length % 25 === 0 || issuedRows.length >= target) {
          console.log(
            JSON.stringify({
              stage,
              issued: Math.min(issuedRows.length, target),
              target,
              failed,
              remaining: Math.max(0, target - issuedRows.length),
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
  }

  await new Promise((resolve, reject) => {
    ck.end(() => resolve());
    ck.on("error", reject);
  });

  // Stable order by employee index; exact stage size; no duplicate identities.
  issuedRows.sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  const unique = [];
  const seenU = new Set();
  const seenE = new Set();
  for (const r of issuedRows) {
    if (seenU.has(r.user_id) || seenE.has(r.email)) continue;
    if (!r.access_token || !r.company_id || !r.provider_id) continue;
    seenU.add(r.user_id);
    seenE.add(r.email);
    unique.push(r);
    if (unique.length >= target) break;
  }

  if (unique.length < target) {
    const summary = {
      phase: "18SCALE",
      stage,
      ACTIVE_LOAD_SESSIONS: unique.length,
      target,
      candidates: candidates.length,
      failed,
      fail_sample: failSample,
      SESSION_POOL_STRICT_EQUALITY: "FAIL",
    };
    fs.writeFileSync(path.join(OUT, `issue-auth-sessions-${stage}.json`), JSON.stringify(summary, null, 2));
    throw new Error(
      `PHASE18_SESSION_POOL_UNDERFILLED stage=${stage} issued=${unique.length} target=${target} failed=${failed}`,
    );
  }

  const finalRows = unique.slice(0, target);
  fs.writeFileSync(stagePath, finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return {
    stage,
    path: stagePath,
    rows: finalRows.length,
    unique_users: new Set(finalRows.map((r) => r.user_id)).size,
    unique_emails: new Set(finalRows.map((r) => r.email)).size,
    candidates: candidates.length,
    failed,
    fail_sample: failSample,
  };
}

async function main() {
  const { url } = loadPhase18Env();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
  process.env.PHASE18_SYNTH_PASSWORD = password;

  fs.mkdirSync(OUT, { recursive: true });

  const concurrency = Number(process.env.PHASE18_SESSION_CONCURRENCY || 12);
  const attempts = Number(process.env.PHASE18_SESSION_ATTEMPTS || 5);
  const mode = String(process.env.PHASE18_SESSION_MODE || "stage").toLowerCase();

  let stages = [];
  if (mode === "all-stages") {
    stages = Object.keys(SESSION_STAGE_TARGETS);
  } else if (process.env.PHASE18_SESSION_STAGES) {
    stages = String(process.env.PHASE18_SESSION_STAGES)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    stages = [resolveSessionStage()];
  }

  // When continuing past smoke-100, mint every stage pool in one job.
  if (["1", "true", "yes"].includes(String(process.env.PHASE18_SESSION_PREPARE_ALL || "").toLowerCase())) {
    stages = Object.keys(SESSION_STAGE_TARGETS);
  }

  const maxTarget = Math.max(...stages.map((s) => sessionTargetForStage(s)));
  const forceExport = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_FORCE_MANIFEST_EXPORT || "").toLowerCase(),
  );
  let allRows = await loadManifestRows(MANIFEST);
  const uniqueManifest = new Set(allRows.map((r) => r.user_id).filter(Boolean)).size;
  // Never silently reuse a truncated/stale manifest under the stage requirement.
  if (forceExport || allRows.length < maxTarget || uniqueManifest < maxTarget) {
    const exported = await exportManifestFromCloud(admin);
    if (exported < 1) throw new Error("manifest_export_empty");
    allRows = await loadManifestRows(MANIFEST);
  }
  if (allRows.length < 1) throw new Error("manifest_empty");
  if (new Set(allRows.map((r) => r.user_id).filter(Boolean)).size < maxTarget) {
    throw new Error(
      `PHASE18_MANIFEST_UNIQUE_UNDERFILLED need=${maxTarget} unique=${new Set(allRows.map((r) => r.user_id)).size}`,
    );
  }

  const results = [];
  for (const stage of stages) {
    const target = sessionTargetForStage(stage);
    const r = await issueStage({
      anon,
      admin,
      password,
      allRows,
      stage,
      target,
      concurrency,
      attempts,
    });
    results.push(r);
  }

  // Active default pointer for current primary stage (smoke-100 unless overridden).
  const primary = resolveSessionStage();
  const primaryPath = stageSessionsPath(OUT, primary);
  if (!fs.existsSync(primaryPath)) {
    throw new Error(`primary_stage_sessions_missing:${primary}`);
  }
  fs.copyFileSync(primaryPath, path.join(OUT, "sessions.ndjson"));

  const summary = {
    phase: "18SCALE",
    strategy: "stage_unique",
    SESSION_WRAP: false,
    TOTAL_EMPLOYEE_PROFILES: allRows.length,
    AUTH_IDENTITIES: allRows.length,
    stages: results,
    primary_stage: primary,
    sessions_path: "sessions.ndjson",
    stage_paths: results.map((r) => path.basename(r.path)),
    ACTIVE_LOAD_SESSIONS: results.find((r) => r.stage === primary)?.rows || 0,
    PEAK_CONCURRENT_SESSIONS: "n/a_until_load_wave",
    note: "Stage pools are unique one-user-per-row; wrap forbidden for strict equality stages.",
  };
  fs.writeFileSync(path.join(OUT, "issue-auth-sessions.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  for (const r of results) {
    if (r.rows < sessionTargetForStage(r.stage) || r.unique_users < r.rows || r.unique_emails < r.rows) {
      process.exit(2);
    }
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
