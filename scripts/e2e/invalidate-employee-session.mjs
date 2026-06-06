#!/usr/bin/env node
/**
 * Self-heal probe helper — simulates concurrent re-seed invalidating employee session.
 * auth.admin.updateUserById (password) revokes active refresh tokens (uigx only).
 */
import { createClient } from "@supabase/supabase-js";

const UIGX_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";

function requireEnv(name) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} required`);
  return v;
}

async function main() {
  const email = requireEnv("E2E_EMPLOYEE_EMAIL");
  const password = requireEnv("E2E_EMPLOYEE_PASSWORD");
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url.includes(UIGX_REF) || url.includes(PROD_REF)) {
    throw new Error("invalidate-employee-session: refuse non-uigx Supabase target");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  const users = data?.users ?? [];
  const user =
    users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;

  if (!user?.id) {
    throw new Error(`employee auth user not found: ${email}`);
  }

  const updated = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });

  if (updated.error) {
    throw new Error(`updateUserById ${email}: ${updated.error.message}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
