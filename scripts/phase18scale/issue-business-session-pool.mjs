#!/usr/bin/env node
/**
 * Issue a business-realistic active load session pool (target 5000).
 * Covers all companies (min 2000) and providers; never creates Auth users.
 * Never prints tokens/passwords/emails.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  ACTIVE_LOAD_SESSIONS_MIN,
  ACTIVE_LOAD_SESSIONS_TARGET,
  COMPANIES_TARGET,
  PROVIDERS_TARGET,
  AUTH_USERS_TARGET,
} from "./lib/business-load-model.mjs";
import { localeForEmployeeIndex } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const MANIFEST = path.join(OUT, "employee-manifest.ndjson");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms) {
  return ms + Math.floor(Math.random() * Math.floor(ms * 0.3 + 1));
}

async function loadNdjson(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

async function exportManifest(admin) {
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
    companyCache.set(companyId, data || {});
    return data || {};
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
          index,
          email: p.email,
          user_id: p.id,
          company_id: p.company_id,
          location_id: p.location_id,
          provider_id: co.provider_id || null,
          country: co.billing_country || null,
          package: pkg,
          locale: localeForEmployeeIndex(index),
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

function selectBusinessPool(allRows, target) {
  const byCompany = new Map();
  const byProvider = new Map();
  for (const r of allRows) {
    if (!r?.user_id || !r?.company_id || !r?.provider_id || !r?.email) continue;
    if (!byCompany.has(r.company_id)) byCompany.set(r.company_id, []);
    byCompany.get(r.company_id).push(r);
    if (!byProvider.has(r.provider_id)) byProvider.set(r.provider_id, []);
    byProvider.get(r.provider_id).push(r);
  }
  const picked = [];
  const seenUsers = new Set();
  const seenCompanies = new Set();
  const seenProviders = new Set();

  // 1) one employee per company (covers 2000 companies)
  const companies = [...byCompany.keys()].sort();
  for (const cid of companies) {
    const row = byCompany.get(cid).sort((a, b) => a.index - b.index)[0];
    if (!row || seenUsers.has(row.user_id)) continue;
    picked.push(row);
    seenUsers.add(row.user_id);
    seenCompanies.add(cid);
    seenProviders.add(row.provider_id);
    if (picked.length >= target) break;
  }

  // 2) ensure every provider represented
  for (const pid of [...byProvider.keys()].sort()) {
    if (seenProviders.has(pid)) continue;
    const row = byProvider.get(pid).find((r) => !seenUsers.has(r.user_id));
    if (!row) continue;
    picked.push(row);
    seenUsers.add(row.user_id);
    seenCompanies.add(row.company_id);
    seenProviders.add(pid);
  }

  // 3) fill to target with additional employees (hot skew candidates = lowest indices first then extras)
  if (picked.length < target) {
    const extras = allRows
      .filter((r) => r?.user_id && r?.company_id && r?.provider_id && !seenUsers.has(r.user_id))
      .sort((a, b) => a.index - b.index);
    for (const row of extras) {
      picked.push(row);
      seenUsers.add(row.user_id);
      if (picked.length >= target) break;
    }
  }

  picked.sort((a, b) => a.index - b.index);
  return {
    picked: picked.slice(0, target),
    companies: seenCompanies.size,
    providers: seenProviders.size,
  };
}

async function issueOne(anon, row, password, attempts) {
  let last = "issue_failed";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await anon.auth.signInWithPassword({ email: row.email, password });
    if (!error && data?.session?.access_token && data?.session?.refresh_token && data?.user?.id === row.user_id) {
      return {
        ...row,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        issued_at: new Date().toISOString(),
        refresh_generation: 1,
        pool: "business-active-load",
      };
    }
    last = String(error?.message || "issue_failed");
    const rate = /rate limit/i.test(last);
    await sleep(jitter(Math.min(rate ? 60000 : 15000, (rate ? 1000 : 400) * attempt * attempt)));
  }
  throw new Error(last.slice(0, 120));
}

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");

  const dryRun = ["1", "true", "yes"].includes(String(process.env.PHASE18_HARNESS_DRY_RUN || "").toLowerCase());
  const target = Number(
    process.env.PHASE18_ACTIVE_LOAD_SESSIONS || (dryRun ? 10 : ACTIVE_LOAD_SESSIONS_TARGET),
  );
  const minRequired = Number(
    process.env.PHASE18_ACTIVE_LOAD_SESSIONS_MIN || (dryRun ? 10 : ACTIVE_LOAD_SESSIONS_MIN),
  );
  const requireFullCoverage = !dryRun;
  const concurrency = Number(process.env.PHASE18_SESSION_CONCURRENCY || 2);
  const attempts = Number(process.env.PHASE18_SESSION_ATTEMPTS || 10);
  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
  process.env.PHASE18_SYNTH_PASSWORD = password;

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let allRows = await loadNdjson(MANIFEST);
  const minManifest = dryRun ? target : AUTH_USERS_TARGET;
  if (allRows.length < minManifest) {
    const n = await exportManifest(admin);
    if (n < minManifest) throw new Error(`PHASE18_AUTH_USERS_UNDERFILLED exported=${n}`);
    allRows = await loadNdjson(MANIFEST);
  }

  const { picked, companies, providers } = selectBusinessPool(allRows, target);
  if (picked.length < minRequired) {
    throw new Error(`PHASE18_BUSINESS_POOL_UNDERSELECT picked=${picked.length} min=${minRequired}`);
  }
  if (requireFullCoverage && companies < COMPANIES_TARGET) {
    throw new Error(`PHASE18_COMPANY_COVERAGE_FAIL covered=${companies} need=${COMPANIES_TARGET}`);
  }
  if (requireFullCoverage && providers < PROVIDERS_TARGET) {
    throw new Error(`PHASE18_PROVIDER_COVERAGE_FAIL covered=${providers} need=${PROVIDERS_TARGET}`);
  }

  const outPath = path.join(OUT, "sessions-business-active-load.ndjson");
  const ckPath = path.join(OUT, "sessions-business-active-load.checkpoint.ndjson");
  const issued = [];
  const failSample = [];
  let cursor = 0;
  let failed = 0;

  async function worker() {
    while (cursor < picked.length) {
      const i = cursor;
      cursor += 1;
      const row = picked[i];
      try {
        const packed = await issueOne(anon, row, password, attempts);
        issued.push(packed);
        if (issued.length % 25 === 0) {
          fs.writeFileSync(ckPath, issued.map((r) => JSON.stringify(r)).join("\n") + "\n");
          console.log(JSON.stringify({ issued: issued.length, target: picked.length, failed }));
        }
      } catch (e) {
        failed += 1;
        if (failSample.length < 40) {
          failSample.push({
            index: row.index,
            reason: String(e?.message || e).slice(0, 120).replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"),
          });
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, picked.length) }, () => worker()));
  issued.sort((a, b) => a.index - b.index);
  fs.writeFileSync(outPath, issued.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(ckPath, issued.map((r) => JSON.stringify(r)).join("\n") + "\n");
  // Also publish as sessions.ndjson + smoke-sized aliases for dry-run/ramps.
  fs.copyFileSync(outPath, path.join(OUT, "sessions.ndjson"));

  const companySet = new Set(issued.map((r) => r.company_id));
  const providerSet = new Set(issued.map((r) => r.provider_id));
  const report = {
    phase: "18SCALE",
    AUTH_USERS_EXIST: allRows.length,
    EMPLOYEE_PROFILES_EXIST: allRows.length,
    COMPANIES_COVERED_BY_ACTIVE_SESSION: `${companySet.size}/${COMPANIES_TARGET}`,
    PROVIDERS_COVERED_BY_ACTIVE_SESSION: `${providerSet.size}/${PROVIDERS_TARGET}`,
    ACTIVE_LOAD_SESSIONS: issued.length,
    TARGET_ACTIVE_LOAD_SESSIONS: target,
    SERVICE_ROLE_AS_EMPLOYEE: 0,
    SESSION_DUPLICATE_USER_IDS: issued.length - new Set(issued.map((r) => r.user_id)).size,
    SESSION_INVALID_COMPANY_RELATIONS: issued.filter((r) => !r.company_id).length,
    SESSION_INVALID_PROVIDER_PATHS: issued.filter((r) => !r.provider_id).length,
    failed,
    fail_sample: failSample,
    HARNESS_DRY_RUN: dryRun,
    AUTH_SESSION_COVERAGE:
      issued.length >= minRequired &&
      failed === 0 &&
      (!requireFullCoverage ||
        (companySet.size >= COMPANIES_TARGET && providerSet.size >= PROVIDERS_TARGET))
        ? "PASS"
        : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "auth-session-coverage.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.AUTH_SESSION_COVERAGE !== "PASS") {
    throw new Error(`PHASE18_AUTH_SESSION_COVERAGE_FAIL sessions=${issued.length} failed=${failed}`);
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
