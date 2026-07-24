#!/usr/bin/env node
/**
 * Targeted password reauthentication for canonical users whose refresh token is dead.
 * Never creates Auth users. Never prints secrets.
 */
import crypto from "node:crypto";
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

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const indicesEnv = String(process.env.PHASE18_REAUTH_INDICES || "").trim();
  const fromFailures = path.join(OUT, "session-refresh-canonical-cycle-1.json");
  let indices = new Set(
    indicesEnv
      ? indicesEnv.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
      : [],
  );
  if (!indices.size && fs.existsSync(fromFailures)) {
    const rep = JSON.parse(fs.readFileSync(fromFailures, "utf8"));
    for (const f of rep.failures || []) {
      if (
        [
          "REFRESH_TOKEN_ALREADY_USED",
          "REFRESH_TOKEN_ROTATED_STALE_COPY",
          "INVALID_GRANT",
          "REFRESH_TOKEN_EXPIRED",
          "PASSWORD_REAUTH_REQUIRED",
        ].includes(f.class)
      ) {
        indices.add(Number(f.index));
      }
    }
  }

  const rows = await loadNdjson(canonicalPath(OUT));
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  const targets = [...byUser.values()].filter((r) => indices.has(Number(r.index)));
  if (!targets.length) {
    const empty = {
      phase: "18SCALE",
      TARGETED_REAUTH_USERS: 0,
      TARGETED_REAUTH_SUCCESS: 0,
      NEW_AUTH_USERS_CREATED: 0,
      BUSINESS_IDENTITIES_SUBSTITUTED: 0,
      UNRELATED_SESSIONS_REISSUED: 0,
      TARGETED_REAUTH: "PASS",
      stamped_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(OUT, "session-reauth-canonical.json"), JSON.stringify(empty, null, 2));
    console.log(JSON.stringify(empty, null, 2));
    return;
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = synthPassword();
  process.env.PHASE18_SYNTH_PASSWORD = password;

  const concurrency = Number(process.env.PHASE18_REAUTH_CONCURRENCY || 2);
  const attempts = Number(process.env.PHASE18_REAUTH_ATTEMPTS || 8);
  let cursor = 0;
  let success = 0;
  let failed = 0;
  const failSample = [];

  async function worker() {
    while (cursor < targets.length) {
      const i = cursor;
      cursor += 1;
      const row = targets[i];
      // Verify Auth identity + business path before password login.
      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(row.user_id);
      if (userErr || !userData?.user?.id) {
        failed += 1;
        if (failSample.length < 30) {
          failSample.push({ index: row.index, class: "USER_DISABLED_OR_MISSING" });
        }
        continue;
      }
      const { data: prof } = await admin
        .from("profiles")
        .select("company_id,location_id")
        .eq("id", row.user_id)
        .maybeSingle();
      if (!prof?.company_id || prof.company_id !== row.company_id) {
        failed += 1;
        if (failSample.length < 30) {
          failSample.push({ index: row.index, class: "ANOTHER_EXACT_CAUSE", reason: "company_mismatch" });
        }
        continue;
      }

      let ok = false;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const { data, error } = await anon.auth.signInWithPassword({
          email: row.email,
          password,
        });
        if (
          !error &&
          data?.session?.access_token &&
          data?.session?.refresh_token &&
          data?.user?.id === row.user_id
        ) {
          byUser.set(
            row.user_id,
            toCanonicalRecord(
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
                project_ref: row.project_ref,
                run_date_checksum: row.run_date_checksum,
                last_successful_refresh_at: new Date().toISOString(),
              },
            ),
          );
          success += 1;
          ok = true;
          break;
        }
        const cls = classifyRefreshError(error, error?.status);
        if (cls === "AUTH_RATE_LIMIT") {
          await sleep(jitter(Math.min(30000, 1000 * attempt * attempt)));
          continue;
        }
        await sleep(jitter(Math.min(15000, 600 * attempt * attempt)));
        if (attempt === attempts) {
          failed += 1;
          if (failSample.length < 30) {
            failSample.push({
              index: row.index,
              class: cls === "ANOTHER_EXACT_CAUSE" ? "PASSWORD_REAUTH_REQUIRED" : cls,
              description_redacted: String(error?.message || "reauth_failed")
                .slice(0, 120)
                .replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"),
            });
          }
        }
      }
      if (!ok && failSample.length && failSample[failSample.length - 1]?.index !== row.index) {
        /* counted */
      }
      if (success % 10 === 0) {
        writeCanonicalStore(OUT, [...byUser.values()], { TARGETED_REAUTH_PARTIAL: true });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  writeCanonicalStore(OUT, [...byUser.values()], { TARGETED_REAUTH: failed === 0 ? "PASS" : "FAIL" });

  const report = {
    phase: "18SCALE",
    TARGETED_REAUTH_USERS: targets.length,
    TARGETED_REAUTH_SUCCESS: success,
    TARGETED_REAUTH_FAILURES: failed,
    NEW_AUTH_USERS_CREATED: 0,
    BUSINESS_IDENTITIES_SUBSTITUTED: 0,
    UNRELATED_SESSIONS_REISSUED: 0,
    fail_sample: failSample,
    TARGETED_REAUTH: failed === 0 && success === targets.length ? "PASS" : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "session-reauth-canonical.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.TARGETED_REAUTH !== "PASS") {
    throw new Error(
      `PHASE18_TARGETED_REAUTH_FAILED success=${success} targets=${targets.length} failed=${failed}`,
    );
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
