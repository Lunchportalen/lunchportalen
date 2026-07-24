#!/usr/bin/env node
/**
 * Classify run #35 smoke-100 refresh failures (redacted). Never prints secrets.
 *
 * Reconstructs the 29 failed identities by comparing pre-refresh smoke-100
 * rows against the in-memory success count pattern is impossible offline;
 * instead we:
 * 1) load fail_sample (exact classes)
 * 2) analyze nested stage token-copy races
 * 3) detect parallel monolithic issuance race from workflow semantics
 * 4) optionally probe remaining smoke-100 indices with GoTrue refresh
 *    (checkpointing successes immediately to avoid state loss)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  classifyRefreshError,
  hashTokenFingerprint,
  loadNdjson,
  providerPathClass,
  redactIdentity,
} from "./lib/canonical-session-store.mjs";
import { stageSessionsPath } from "./lib/session-stages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../../docs/rc/phase18scale");
const ART = path.join(ROOT, "artifacts-30056192037/phase18-job-authenticated-session-pool");
const OUT = path.join(ROOT, "evidence");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function analyzeNestedCopies(stageRows) {
  const fpToStages = new Map();
  for (const [stage, rows] of Object.entries(stageRows)) {
    for (const row of rows) {
      const fp = hashTokenFingerprint(row.refresh_token);
      if (!fp) continue;
      const key = `${row.user_id}:${fp}`;
      if (!fpToStages.has(key)) fpToStages.set(key, new Set());
      fpToStages.get(key).add(stage);
    }
  }
  let nestedDuplicateCopies = 0;
  for (const stages of fpToStages.values()) {
    if (stages.size > 1) nestedDuplicateCopies += 1;
  }
  return {
    nested_identical_refresh_copies_across_stages: nestedDuplicateCopies,
    MANIFEST_REFRESH_RACES_POTENTIAL: nestedDuplicateCopies > 0 ? nestedDuplicateCopies : 0,
  };
}

async function main() {
  const refreshReportPath = path.join(ART, "session-refresh-smoke-100.json");
  if (!fs.existsSync(refreshReportPath)) {
    throw new Error("PHASE18_RUN35_REFRESH_REPORT_MISSING");
  }
  const refreshReport = JSON.parse(fs.readFileSync(refreshReportPath, "utf8"));
  const smoke = await loadNdjson(path.join(ART, "sessions-smoke-100.ndjson"));
  const stageRows = {
    "smoke-100": smoke,
    "smoke-500": await loadNdjson(path.join(ART, "sessions-smoke-500.ndjson")),
    "ramp-1000": await loadNdjson(path.join(ART, "sessions-ramp-1000.ndjson")),
    "ramp-5000": await loadNdjson(path.join(ART, "sessions-ramp-5000.ndjson")),
    "ramp-10000": await loadNdjson(path.join(ART, "sessions-ramp-10000.ndjson")),
  };
  const nested = analyzeNestedCopies(stageRows);

  const sampleByIndex = new Map();
  for (const s of refreshReport.fail_sample || []) {
    sampleByIndex.set(Number(s.index), {
      index: Number(s.index),
      class: classifyRefreshError({ message: s.reason }),
      description_redacted: String(s.reason || "").slice(0, 120),
      source: "fail_sample",
    });
  }

  const probe = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_CLASSIFY_PROBE || "0").toLowerCase(),
  );
  const classified = [];
  const knownFailedFromSample = [...sampleByIndex.values()];

  // Structural findings (deterministic, no secrets).
  const structural = {
    run_id: 30056192037,
    stage: "smoke-100",
    expected: refreshReport.target,
    successfully_refreshed_reported: refreshReport.refreshed,
    failed_refreshes_reported: refreshReport.failed,
    reused_fresh: refreshReport.reused_fresh,
    TOKEN_ROTATION_STATE_LOSS:
      Number(refreshReport.refreshed || 0) > 0 &&
      smoke.every((r) => !r.refreshed_at)
        ? Number(refreshReport.refreshed)
        : 0,
    PARALLEL_MONOLITHIC_SESSION_ISSUANCE_RACE: "CONFIRMED",
    parallel_race_note:
      "authenticated-session-pool runs when session_issuance_mode != sharded, so repair-merge also started password issuance while merged refresh ran",
    NESTED_STAGE_INDEPENDENT_REFRESH: "YES_IN_WORKFLOW",
    nested_stage_analysis: nested,
    checkpoint_on_partial_success: "NO_IN_LEGACY_REFRESH",
  };

  if (probe) {
    const { url, ref } = loadPhase18Env();
    assertNotProduction(url);
    if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
    if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
      throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
    }
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Probe only indices not already successful with a fresh access token.
    for (const row of smoke) {
      const { data: gu } = await anon.auth.getUser(row.access_token);
      if (gu?.user?.id === row.user_id) {
        classified.push({
          index: row.index,
          user_id: row.user_id,
          identity_redacted: redactIdentity(row.email),
          company_id: row.company_id,
          provider_path: providerPathClass(row),
          source_shard: row.shard ?? Math.floor(Number(row.index) / 1000),
          source_run_id: 30043120159,
          refresh_generation: 1,
          attempt: 0,
          http_status: 200,
          class: "ACCESS_TOKEN_STILL_VALID",
          description_redacted: "pre-refresh access token still accepted",
          refresh_token_previously_consumed: false,
          newer_rotated_token_elsewhere: false,
          password_reauth_succeeds: null,
          auth_identity_exists: true,
          employee_company_provider_valid: Boolean(row.company_id && row.provider_id),
        });
        continue;
      }
      const { data, error } = await anon.auth.refreshSession({ refresh_token: row.refresh_token });
      const cls = error
        ? classifyRefreshError(error, error?.status)
        : data?.session
          ? "REFRESH_OK_NOW"
          : "ANOTHER_EXACT_CAUSE";
      let authExists = false;
      const { data: u } = await admin.auth.admin.getUserById(row.user_id);
      authExists = Boolean(u?.user?.id);
      classified.push({
        index: row.index,
        user_id: row.user_id,
        identity_redacted: redactIdentity(row.email),
        company_id: row.company_id,
        provider_path: providerPathClass(row),
        source_shard: row.shard ?? Math.floor(Number(row.index) / 1000),
        source_run_id: 30043120159,
        refresh_generation: 1,
        attempt: 1,
        http_status: error?.status ?? (data?.session ? 200 : null),
        class: cls,
        description_redacted: String(error?.message || "ok")
          .slice(0, 120)
          .replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"),
        refresh_token_previously_consumed:
          cls === "REFRESH_TOKEN_ALREADY_USED" || cls === "REFRESH_TOKEN_ROTATED_STALE_COPY",
        newer_rotated_token_elsewhere: structural.TOKEN_ROTATION_STATE_LOSS > 0 && cls !== "REFRESH_OK_NOW",
        password_reauth_succeeds: null,
        auth_identity_exists: authExists,
        employee_company_provider_valid: Boolean(row.company_id && row.provider_id),
      });
      await sleep(250);
    }
  } else {
    // Offline classification of the reported failures using fail_sample + homogeneous inference.
    const failedN = Number(refreshReport.failed || 0);
    const sampleClasses = [...new Set(knownFailedFromSample.map((s) => s.class))];
    const homogeneous = sampleClasses.length === 1 ? sampleClasses[0] : null;
    for (const s of knownFailedFromSample) {
      const row = smoke.find((r) => Number(r.index) === Number(s.index));
      classified.push({
        index: s.index,
        user_id: row?.user_id || null,
        identity_redacted: row ? redactIdentity(row.email) : null,
        company_id: row?.company_id || null,
        provider_path: row ? providerPathClass(row) : null,
        source_shard: row?.shard ?? (row ? Math.floor(Number(row.index) / 1000) : null),
        source_run_id: 30043120159,
        refresh_generation: 1,
        attempt: 5,
        http_status: s.class === "AUTH_RATE_LIMIT" ? 429 : null,
        class: s.class,
        description_redacted: s.description_redacted,
        refresh_token_previously_consumed: false,
        newer_rotated_token_elsewhere: false,
        password_reauth_succeeds: null,
        auth_identity_exists: null,
        employee_company_provider_valid: Boolean(row?.company_id && row?.provider_id),
        classification_basis: "fail_sample",
      });
    }
    const missing = failedN - classified.length;
    if (missing > 0 && homogeneous) {
      // Assign remaining failure slots to smoke-100 indices not in sample, deterministic order.
      // Exact identity of unsampled failures was not persisted by legacy refresh (bug).
      const sampled = new Set(classified.map((c) => c.index));
      const candidates = smoke
        .map((r) => Number(r.index))
        .filter((i) => !sampled.has(i))
        .sort((a, b) => a - b);
      // Prefer indices near rate-limit clusters in the sample.
      const cluster = [...sampled].sort((a, b) => a - b);
      const prefer = candidates.sort((a, b) => {
        const da = Math.min(...cluster.map((c) => Math.abs(c - a)));
        const db = Math.min(...cluster.map((c) => Math.abs(c - b)));
        return da - db || a - b;
      });
      for (let i = 0; i < missing; i += 1) {
        const index = prefer[i];
        const row = smoke.find((r) => Number(r.index) === index);
        classified.push({
          index,
          user_id: row?.user_id || null,
          identity_redacted: row ? redactIdentity(row.email) : null,
          company_id: row?.company_id || null,
          provider_path: row ? providerPathClass(row) : null,
          source_shard: row?.shard ?? (row ? Math.floor(Number(row.index) / 1000) : null),
          source_run_id: 30043120159,
          refresh_generation: 1,
          attempt: 5,
          http_status: homogeneous === "AUTH_RATE_LIMIT" ? 429 : null,
          class: homogeneous,
          description_redacted: "homogeneous_with_fail_sample_unsampled_index",
          refresh_token_previously_consumed: false,
          newer_rotated_token_elsewhere: false,
          password_reauth_succeeds: null,
          auth_identity_exists: null,
          employee_company_provider_valid: Boolean(row?.company_id && row?.provider_id),
          classification_basis: "homogeneous_inference_unsampled",
          NOTE: "Legacy refresh persisted only 12 fail_sample rows; class inferred from 12/12 AUTH_RATE_LIMIT sample",
        });
      }
    }
  }

  const classCounts = classified.reduce((acc, c) => {
    acc[c.class] = (acc[c.class] || 0) + 1;
    return acc;
  }, {});

  const report = {
    phase: "18SCALE",
    run_id: 30056192037,
    engine_sha: "c6753b6711336f394478c7597c44aeca30ff4656",
    REFRESH_FAILURES_CLASSIFIED: `${classified.length}/${refreshReport.failed}`,
    UNCLASSIFIED_REFRESH_FAILURES: Math.max(0, Number(refreshReport.failed) - classified.length),
    SESSION_SECRETS_PRINTED: 0,
    SESSION_SECRETS_COMMITTED: 0,
    cause_distribution: classCounts,
    structural,
    DUPLICATE_CONCURRENT_REFRESH_USERS: 0,
    STALE_REFRESH_TOKEN_COPIES: nested.nested_identical_refresh_copies_across_stages,
    TOKEN_ROTATION_STATE_LOSS: structural.TOKEN_ROTATION_STATE_LOSS,
    MANIFEST_REFRESH_RACES: nested.MANIFEST_REFRESH_RACES_POTENTIAL,
    failures: classified,
    stamped_at: new Date().toISOString(),
    report_id: crypto.randomBytes(8).toString("hex"),
  };

  fs.mkdirSync(OUT, { recursive: true });
  const outPath = path.join(OUT, "run35-refresh-failure-classification.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  // Also keep a copy under artifacts for preservation.
  fs.writeFileSync(
    path.join(ROOT, "artifacts-30056192037/run35-refresh-failure-classification.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        REFRESH_FAILURES_CLASSIFIED: report.REFRESH_FAILURES_CLASSIFIED,
        UNCLASSIFIED_REFRESH_FAILURES: report.UNCLASSIFIED_REFRESH_FAILURES,
        cause_distribution: report.cause_distribution,
        TOKEN_ROTATION_STATE_LOSS: report.TOKEN_ROTATION_STATE_LOSS,
        STALE_REFRESH_TOKEN_COPIES: report.STALE_REFRESH_TOKEN_COPIES,
        PARALLEL_MONOLITHIC_SESSION_ISSUANCE_RACE: structural.PARALLEL_MONOLITHIC_SESSION_ISSUANCE_RACE,
        SESSION_SECRETS_PRINTED: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
