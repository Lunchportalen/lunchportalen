#!/usr/bin/env node
/**
 * Issue synthetic employee sessions (password / magic-link) for load waves.
 * STRATEGY=coverage → ≥1 session per company + extras for hot companies.
 * Does NOT claim 100k concurrent sessions when fewer were issued.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const MANIFEST = path.join(OUT, "employee-manifest.ndjson");
const SESSIONS = path.join(OUT, "sessions.ndjson");

async function loadManifest() {
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(MANIFEST), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

function pickCoverage(rows, extrasPerHot = 20) {
  const byCompany = new Map();
  for (const r of rows) {
    if (!byCompany.has(r.company_id)) byCompany.set(r.company_id, []);
    byCompany.get(r.company_id).push(r);
  }
  const picked = [];
  const companies = [...byCompany.entries()];
  for (const [, emps] of companies) {
    picked.push(emps[0]);
  }
  // Hot companies: first 10 by size get extras
  const hot = companies.sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  for (const [, emps] of hot) {
    for (let i = 1; i < Math.min(emps.length, extrasPerHot + 1); i += 1) {
      picked.push(emps[i]);
    }
  }
  return picked;
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
  if (!fs.existsSync(MANIFEST)) throw new Error(`missing ${MANIFEST} — run export-employee-manifest first`);

  const strategy = String(process.env.PHASE18_SESSION_STRATEGY || "coverage").toLowerCase();
  const limit = Number(process.env.PHASE18_SESSION_LIMIT || 0);
  const concurrency = Number(process.env.PHASE18_SESSION_CONCURRENCY || 12);
  const all = await loadManifest();
  let selected = strategy === "all" ? all : pickCoverage(all, Number(process.env.PHASE18_SESSION_HOT_EXTRAS || 20));
  if (limit > 0) selected = selected.slice(0, limit);

  const out = fs.createWriteStream(SESSIONS);
  let issued = 0;
  let failed = 0;
  const countries = new Set();
  const locales = new Set();
  const packages = new Set();
  const companies = new Set();

  async function issueOne(row) {
    let session = null;
    const pw = await anon.auth.signInWithPassword({ email: row.email, password });
    if (!pw.error) session = pw.data.session;
    if (!session) {
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email });
      if (!link.error && link.data?.properties?.hashed_token) {
        const verified = await anon.auth.verifyOtp({
          type: "email",
          token_hash: link.data.properties.hashed_token,
        });
        if (!verified.error) session = verified.data.session;
      }
    }
    if (!session) throw new Error(pw.error?.message || "no session");
    out.write(
      `${JSON.stringify({
        email: row.email,
        user_id: row.user_id,
        company_id: row.company_id,
        provider_id: row.provider_id,
        country: row.country,
        package: row.package,
        locale: row.locale,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })}\n`,
    );
    issued += 1;
    countries.add(row.country);
    locales.add(row.locale);
    packages.add(row.package);
    companies.add(row.company_id);
  }

  async function mapPool(items, limitN, fn) {
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const idx = i;
        i += 1;
        await fn(items[idx]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limitN, items.length) }, () => worker()));
  }

  await mapPool(selected, concurrency, async (row) => {
    try {
      await issueOne(row);
      if (issued % 200 === 0) console.log(`sessions issued=${issued} failed=${failed}`);
    } catch (e) {
      failed += 1;
      console.warn(`session fail ${row.email}: ${e.message}`);
    }
  });
  out.end();

  const summary = {
    phase: "18SCALE",
    strategy,
    TOTAL_EMPLOYEE_PROFILES: all.length,
    AUTH_IDENTITIES: all.length,
    ACTIVE_LOAD_SESSIONS: issued,
    PEAK_CONCURRENT_SESSIONS: "n/a_until_load_wave",
    failed,
    companies_covered: companies.size,
    countries_covered: countries.size,
    locales_covered: locales.size,
    packages_covered: [...packages],
    sessions_path: "sessions.ndjson",
    note: "Do not report ACTIVE_LOAD_SESSIONS as 100000 unless 100000 sessions were issued.",
  };
  fs.writeFileSync(path.join(OUT, "issue-auth-sessions.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (issued === 0) process.exit(2);
  if (strategy === "coverage" && companies.size < 2000) {
    console.warn(`coverage incomplete: companies_covered=${companies.size}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
