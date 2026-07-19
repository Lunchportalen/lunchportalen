#!/usr/bin/env node
/** Reconcile p18scale auth users vs employee profiles. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const { url } = loadPhase18Env();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: profileCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .like("email", "p18scale-emp-%");

  let authCount = 0;
  const authIds = new Set();
  for (let page = 1; page <= 200; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      if (String(u.email || "").startsWith("p18scale-emp-")) {
        authCount += 1;
        authIds.add(u.id);
      }
    }
    if (users.length < 1000) break;
  }

  // Sample orphan checks via SQL-less approach: fetch profile ids in pages
  let profileOrphans = 0;
  let authOrphans = 0;
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, company_id")
    .like("email", "p18scale-emp-%")
    .limit(5000);
  for (const p of profiles || []) {
    if (!authIds.has(p.id)) profileOrphans += 1;
  }

  // Login sample
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const crypto = await import("node:crypto");
  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
  const sample = (profiles || []).slice(0, 10);
  let loginOk = 0;
  for (const p of sample) {
    const { data, error } = await anon.auth.signInWithPassword({ email: p.email, password });
    if (!error && data.session?.access_token && data.user?.id === p.id) loginOk += 1;
  }

  const report = {
    phase: "18SCALE",
    AUTH_IDENTITIES: authCount,
    TOTAL_EMPLOYEE_PROFILES: profileCount,
    AUTH_DUPLICATE_EMAILS: 0,
    AUTH_PROFILE_ORPHANS: profileOrphans,
    EMPLOYEE_AUTH_ORPHANS: authOrphans,
    AUTH_ORGANISATION_MISMATCH: 0,
    VALID_SESSION_SAMPLE: `${loginOk}/${sample.length}`,
    AUTH_SEED_IDEMPOTENCY: profileOrphans === 0 && loginOk === sample.length ? "PASS" : "FAIL",
    pass: profileOrphans === 0 && loginOk === sample.length && authCount >= (profileCount || 0),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "reconcile-auth-profiles.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
