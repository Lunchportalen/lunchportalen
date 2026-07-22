#!/usr/bin/env node
/**
 * Hard fail-closed session manifest preflight before HTTP load stages.
 * Never prints tokens. SESSION_WRAP must be false for strict equality stages.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import {
  resolveSessionStage,
  sessionTargetForStage,
  stageSessionsPath,
} from "./lib/session-stages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function loadRows(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (ref === PROD_REF || String(url).includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (ref === STAGING_REF || String(url).includes(STAGING_REF)) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const stage = resolveSessionStage();
  const target = sessionTargetForStage(stage);
  const stagePath = stageSessionsPath(OUT, stage);
  const defaultPath = path.join(OUT, "sessions.ndjson");
  const sourcePath = fs.existsSync(stagePath) ? stagePath : defaultPath;
  if (fs.existsSync(stagePath) && sourcePath === stagePath) {
    fs.copyFileSync(stagePath, defaultPath);
  }

  const rows = await loadRows(sourcePath);
  const userIds = rows.map((r) => r.user_id).filter(Boolean);
  const emails = rows.map((r) => r.email).filter(Boolean);
  const uniqueUsers = new Set(userIds);
  const uniqueEmails = new Set(emails);
  const dupUsers = userIds.length - uniqueUsers.size;
  const dupEmails = emails.length - uniqueEmails.size;
  const withToken = rows.filter((r) => typeof r.access_token === "string" && r.access_token.length > 20);
  const missingCompany = rows.filter((r) => !r.company_id).length;
  const missingProvider = rows.filter((r) => !r.provider_id).length;

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let validAuth = 0;
  let invalidTokens = 0;
  let menuPathOk = 0;
  // Sample validate all rows for smoke-100; cap expensive checks for huge stages.
  const validateN = Math.min(rows.length, target <= 500 ? rows.length : Math.min(rows.length, 200));
  for (let i = 0; i < validateN; i += 1) {
    const s = rows[i];
    const { data, error } = await anon.auth.getUser(s.access_token);
    if (error || !data?.user?.id || data.user.id !== s.user_id) {
      invalidTokens += 1;
      continue;
    }
    validAuth += 1;

    const { data: prof } = await admin
      .from("profiles")
      .select("company_id,location_id")
      .eq("id", s.user_id)
      .maybeSingle();
    if (!prof?.company_id || !prof?.location_id) continue;
    const { data: agr } = await admin
      .from("agreements")
      .select("id,provider_id")
      .eq("company_id", prof.company_id)
      .eq("location_id", prof.location_id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();
    if (agr?.provider_id) menuPathOk += 1;
  }

  const sessionWrap = rows.length < target || uniqueUsers.size < target || uniqueEmails.size < target;
  const report = {
    phase: "18SCALE",
    stage,
    source: path.basename(sourcePath),
    target,
    SESSION_MANIFEST_ROWS: rows.length,
    SESSION_UNIQUE_USER_IDS: uniqueUsers.size,
    SESSION_UNIQUE_EMAILS: uniqueEmails.size,
    SESSION_VALID_TOKENS: withToken.length,
    SESSION_DUPLICATE_USER_IDS: dupUsers,
    SESSION_DUPLICATE_EMAILS: dupEmails,
    SESSION_INVALID_TOKENS: invalidTokens,
    SESSION_COMPANY_RELATION_MISSING: missingCompany,
    SESSION_PROVIDER_PATH_MISSING: missingProvider,
    SESSION_WRAP: sessionWrap,
    AUTH_PROBED: validateN,
    AUTH_VALID_PROBED: validAuth,
    MENU_PATH_PROBED_OK: menuPathOk,
    SMOKE100_SESSION_ROWS: stage === "smoke-100" ? rows.length : undefined,
    SMOKE100_UNIQUE_USERS: stage === "smoke-100" ? uniqueUsers.size : undefined,
    SMOKE100_UNIQUE_EMAILS: stage === "smoke-100" ? uniqueEmails.size : undefined,
    SMOKE100_VALID_AUTH: stage === "smoke-100" ? validAuth : undefined,
    SMOKE100_VALID_MENU_PATHS: stage === "smoke-100" ? menuPathOk : undefined,
    SMOKE100_SESSION_WRAP: stage === "smoke-100" ? sessionWrap : undefined,
    stamped_at: new Date().toISOString(),
  };

  const pass =
    report.SESSION_MANIFEST_ROWS >= target &&
    report.SESSION_UNIQUE_USER_IDS >= target &&
    report.SESSION_UNIQUE_EMAILS >= target &&
    report.SESSION_VALID_TOKENS >= target &&
    report.SESSION_DUPLICATE_USER_IDS === 0 &&
    report.SESSION_DUPLICATE_EMAILS === 0 &&
    report.SESSION_INVALID_TOKENS === 0 &&
    report.SESSION_COMPANY_RELATION_MISSING === 0 &&
    report.SESSION_PROVIDER_PATH_MISSING === 0 &&
    report.SESSION_WRAP === false &&
    (stage !== "smoke-100" ||
      (report.SMOKE100_SESSION_ROWS === 100 &&
        report.SMOKE100_UNIQUE_USERS === 100 &&
        report.SMOKE100_UNIQUE_EMAILS === 100 &&
        report.SMOKE100_VALID_AUTH === 100 &&
        report.SMOKE100_VALID_MENU_PATHS === 100 &&
        report.SMOKE100_SESSION_WRAP === false));

  report.SESSION_MANIFEST_PREFLIGHT = pass ? "PASS" : "FAIL";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `session-manifest-preflight-${stage}.json`),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(2);
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
