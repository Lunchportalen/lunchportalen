#!/usr/bin/env node
/**
 * PHASE 18SCALE — local-only GoTrue-compatible bulk Auth bootstrap.
 *
 * Uses an existing synthetic user's encrypted_password (same PHASE18_SYNTH_PASSWORD)
 * and inserts missing auth.users + auth.identities via psql in the local Docker DB.
 *
 * NOT proof that cloud Auth Admin API scales — verify samples via GoTrue login after.
 * Refuses non-local targets.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction } from "./load-env.mjs";
import { synthEmail, localeForEmployeeIndex } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const DB_CONTAINER = process.env.PHASE18_DB_CONTAINER || "supabase_db_lunchportalen";

function envInt(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") return Number(v);
  }
  return NaN;
}

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

function psqlFile(sqlBody) {
  const tmp = path.join(OUT, `_bulk_auth_${Date.now()}.sql`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(tmp, sqlBody, "utf8");
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
      { input: fs.readFileSync(tmp), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  if (!/127\.0\.0\.1|localhost|kong/i.test(url)) {
    throw new Error("BULK_AUTH_LOCAL_ONLY: refusing non-local target");
  }

  const from = envInt("PHASE18_BULK_AUTH_FROM") || 0;
  const to = envInt("PHASE18_BULK_AUTH_TO", "PHASE18_EMPLOYEES", "PHASE18_SEED_EMPLOYEES") || 100000;
  const batch = envInt("PHASE18_BULK_AUTH_BATCH") || 2000;
  const verifyN = envInt("PHASE18_BULK_AUTH_VERIFY") || 24;

  const template = psql(
    `select id::text || '|' || coalesce(encrypted_password,'') from auth.users where email = 'p18scale-emp-000000@load.lunchportalen.test' and encrypted_password is not null limit 1`,
  );
  if (!template || !template.includes("|")) {
    throw new Error("BULK_AUTH_NO_TEMPLATE: create at least one Auth user via Admin API first");
  }
  const [, encPw] = template.split("|");
  if (!encPw.startsWith("$2")) throw new Error("BULK_AUTH_BAD_HASH");

  let created = 0;
  let skipped = 0;
  for (let start = from; start < to; start += batch) {
    const end = Math.min(to, start + batch);
    const valuesUsers = [];
    const valuesIdent = [];
    for (let i = start; i < end; i += 1) {
      const email = synthEmail("emp", i);
      const id = crypto.randomUUID();
      const locale = localeForEmployeeIndex(i);
      const meta = JSON.stringify({ [MARK]: true, locale, bulk: true }).replace(/'/g, "''");
      const app = JSON.stringify({ [MARK]: true, provider: "email", providers: ["email"] }).replace(/'/g, "''");
      // Token columns must be '' not NULL — GoTrue Scan fails on NULL confirmation_token.
      valuesUsers.push(
        `('00000000-0000-0000-0000-000000000000'::uuid,'${id}'::uuid,'authenticated','authenticated','${esc(email)}','${esc(encPw)}',now(),now(),now(),'${app}'::jsonb,'${meta}'::jsonb,now(),now(),false,false,'','','','')`,
      );
      // GoTrue email identities use user id as provider_id (not email).
      valuesIdent.push(
        `('${id}'::uuid,'${id}','{"sub":"${id}","email":"${esc(email)}","email_verified":true,"phone_verified":false}'::jsonb,'email',now(),now())`,
      );
    }

    const sql = `
BEGIN;
CREATE TEMP TABLE _p18_bulk_users (
  instance_id uuid, id uuid, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, confirmation_sent_at timestamptz,
  recovery_sent_at timestamptz, is_sso_user boolean, is_anonymous boolean,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change_token_current text
) ON COMMIT DROP;
INSERT INTO _p18_bulk_users VALUES
${valuesUsers.join(",\n")};
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_sent_at, recovery_sent_at, is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, phone_change, phone_change_token, reauthentication_token
)
SELECT instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_sent_at, recovery_sent_at, is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  '', '', '', ''
FROM _p18_bulk_users b
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(b.email));

CREATE TEMP TABLE _p18_bulk_ident (
  user_id uuid, provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz
) ON COMMIT DROP;
INSERT INTO _p18_bulk_ident VALUES
${valuesIdent.join(",\n")};
INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT i.user_id, i.provider_id, i.identity_data, i.provider, i.last_sign_in_at, i.created_at, i.created_at
FROM _p18_bulk_ident i
JOIN auth.users u ON u.id = i.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities x WHERE x.provider = 'email' AND x.provider_id = i.provider_id
);
COMMIT;
`;
    psqlFile(sql);
    const have = Number(
      psql(
        `select count(*) from auth.users where email like 'p18scale-emp-%@load.lunchportalen.test'`,
      ) || "0",
    );
    console.log(JSON.stringify({ batch: `${start}-${end}`, total_p18_auth: have }));
    created = have;
  }

  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let loginOk = 0;
  const samples = [];
  for (let s = 0; s < verifyN; s += 1) {
    const idx = from + Math.floor((s * (to - from)) / verifyN);
    const email = synthEmail("emp", idx);
    const pw = await anon.auth.signInWithPassword({ email, password });
    if (!pw.error && pw.data.session?.access_token) {
      loginOk += 1;
      samples.push({ email, user_id: pw.data.user.id, ok: true });
      await anon.auth.signOut().catch(() => {});
    } else {
      samples.push({ email, ok: false, error: pw.error?.message || "no session" });
    }
  }

  const totalAuth = Number(psql(`select count(*) from auth.users where email like 'p18scale-emp-%@load.lunchportalen.test'`) || "0");
  const report = {
    phase: "18SCALE",
    mode: "local_sql_bulk",
    from,
    to,
    AUTH_BULK_CREATED_OR_PRESENT: created,
    AUTH_BULK_SKIPPED_EXISTING_EST: skipped,
    TOTAL_P18_AUTH_USERS: totalAuth,
    VALID_SESSION_SAMPLE: `${loginOk}/${verifyN}`,
    AUTH_SEED_IDEMPOTENCY: loginOk === verifyN ? "PASS" : "FAIL",
    samples: samples.slice(0, 8),
    stamped_at: new Date().toISOString(),
    note: "Local-only. Cloud cert must use Admin API / supported import.",
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "bootstrap-auth-bulk-local.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (loginOk < verifyN) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
