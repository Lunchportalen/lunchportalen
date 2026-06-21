#!/usr/bin/env node
/**
 * Grant E2E test user provider_kitchen on Melhus (staging A6 tenant provider).
 * Enables /leverandor/meny editor access in CI without new credential secrets.
 *
 * Prerequisite: seed-e2e-users.mjs (E2E_TEST_USER_EMAIL must exist).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

import { E2E_CANONICAL_EMAILS } from "../smoke/seed-e2e-users.mjs";

loadDotenv({ path: path.join(process.cwd(), ".env.local") });
loadDotenv({ path: path.join(process.cwd(), ".env") });

const UIGX_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";
const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function assertTargetDb(url) {
  const u = String(url ?? "").trim();
  if (!u) {
    console.error("ABORT: NEXT_PUBLIC_SUPABASE_URL is empty");
    process.exit(2);
  }
  if (u.includes(PROD_REF)) {
    console.error(`ABORT: refuse prod ref ${PROD_REF}`);
    process.exit(2);
  }
  if (!u.includes(UIGX_REF)) {
    console.error(`ABORT: NEXT_PUBLIC_SUPABASE_URL must contain uigx ref ${UIGX_REF}`);
    process.exit(2);
  }
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const users = data?.users ?? [];
  return (
    users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null
  );
}

async function main() {
  const env = { ...loadEnvFile(path.join(process.cwd(), ".env.local")), ...process.env };
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  assertTargetDb(url);

  if (!serviceKey) {
    console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(2);
  }

  const email = String(env.E2E_TEST_USER_EMAIL ?? "").trim().toLowerCase();
  const canonical = E2E_CANONICAL_EMAILS.test_user.toLowerCase();
  if (!email || email !== canonical) {
    console.error(
      `ABORT: E2E_TEST_USER_EMAIL must be ${E2E_CANONICAL_EMAILS.test_user} (got ${email || "empty"})`,
    );
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await findUserByEmail(admin, email);
  if (!user?.id) {
    console.error(`ABORT: auth user not found for ${email} — run seed-e2e-users.mjs first`);
    process.exit(2);
  }

  const { error } = await admin.from("provider_memberships").upsert(
    {
      user_id: user.id,
      provider_id: MELHUS_PROVIDER_ID,
      role: "provider_kitchen",
    },
    { onConflict: "user_id,provider_id" },
  );

  if (error) {
    throw new Error(`provider_memberships upsert: ${error.message}`);
  }

  console.log(
    "E2E_PROVIDER_KITCHEN_ACCESS_OK",
    JSON.stringify({ email, provider_id: MELHUS_PROVIDER_ID, role: "provider_kitchen" }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
