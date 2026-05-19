/**
 * Supabase Auth Admin API — sequential user create/delete for seed scripts.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { assertStagingEmail, STAGING_EMAIL_DOMAIN, type SeedEnv } from "../core/env.js";
import { hashId, logEvent } from "../core/logger.js";

const RUNNER = "auth-admin";

export function stagingPasswordForEmail(email: string): string {
  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex");
  return `Staging${hash.slice(0, 12)}!2026`;
}

export function createAuthAdminClient(env: SeedEnv) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type CreateAuthUserInput = {
  id: string;
  email: string;
  password: string;
  role: "company_admin" | "employee";
  fullName: string;
  phone: string;
  companyId: string;
  locationId: string;
};

export async function createAuthUser(
  env: SeedEnv,
  input: CreateAuthUserInput,
): Promise<{ id: string; email: string }> {
  assertStagingEmail(input.email);
  const admin = createAuthAdminClient(env);

  const { data, error } = await admin.auth.admin.createUser({
    id: input.id,
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      company_id: input.companyId,
      location_id: input.locationId,
      full_name: input.fullName,
      name: input.fullName,
      phone: input.phone,
    },
  });

  if (error) {
    throw new Error(`auth.admin.createUser failed email=${input.email} message=${error.message}`);
  }

  const id = data.user?.id;
  if (!id) {
    throw new Error(`auth.admin.createUser missing id email=${input.email}`);
  }

  logEvent(RUNNER, { action: "auth_user_created", count: 1 });
  return { id, email: input.email };
}

export async function deleteAuthUserById(env: SeedEnv, userId: string): Promise<void> {
  const admin = createAuthAdminClient(env);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(
      `auth.admin.deleteUser failed user_hash=${hashId(userId)} message=${error.message}`,
    );
  }
  logEvent(RUNNER, { action: "auth_user_deleted", count: 1 });
}

export async function listStagingAuthUsers(env: SeedEnv): Promise<Array<{ id: string; email: string }>> {
  const admin = createAuthAdminClient(env);
  const out: Array<{ id: string; email: string }> = [];
  const perPage = 1000;
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`auth.admin.listUsers failed message=${error.message}`);
    }

    const users = data.users ?? [];
    for (const u of users) {
      const email = (u.email ?? "").toLowerCase();
      if (email.endsWith(STAGING_EMAIL_DOMAIN)) {
        out.push({ id: u.id, email });
      }
    }

    if (users.length < perPage) break;
    page += 1;
    if (page > 50) {
      throw new Error("auth.admin.listUsers pagination safety stop");
    }
  }

  return out;
}

export async function deleteAllStagingAuthUsers(env: SeedEnv): Promise<number> {
  const users = await listStagingAuthUsers(env);
  for (const u of users) {
    await deleteAuthUserById(env, u.id);
    await sleep(100);
  }
  return users.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
