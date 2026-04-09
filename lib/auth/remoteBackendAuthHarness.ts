import "server-only";

import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { CANONICAL_REMOTE_BACKEND_HARNESS_PASSWORD } from "@/lib/auth/canonicalDevCredentials";
import { REMOTE_BACKEND_HARNESS_EMAIL } from "@/lib/system/emails";

export const REMOTE_BACKEND_AUTH_HARNESS_FLAG = "LP_REMOTE_BACKEND_AUTH_HARNESS";

const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);
const REMOTE_BACKEND_AUTH_HARNESS_PASSWORD = CANONICAL_REMOTE_BACKEND_HARNESS_PASSWORD;
const REMOTE_BACKEND_AUTH_HARNESS_PAGE_SIZE = 200;
const REMOTE_BACKEND_AUTH_HARNESS_MAX_PAGES = 10;

export type RemoteBackendAuthHarnessCredentials = {
  email: string;
  password: string;
};

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

function isHarnessFlagEnabled(): boolean {
  return ENABLED_VALUES.has(safeTrim(process.env[REMOTE_BACKEND_AUTH_HARNESS_FLAG]).toLowerCase());
}

function buildHarnessCredentials(): RemoteBackendAuthHarnessCredentials {
  return {
    email: REMOTE_BACKEND_HARNESS_EMAIL,
    password: REMOTE_BACKEND_AUTH_HARNESS_PASSWORD,
  };
}

export function isRemoteBackendAuthHarnessEnabled(): boolean {
  const runtime = getCmsRuntimeStatus();
  return runtime.mode === "remote_backend" && isHarnessFlagEnabled() && hasSupabaseAdminConfig();
}

export function getRemoteBackendAuthHarnessCredentials(): RemoteBackendAuthHarnessCredentials | null {
  if (!isRemoteBackendAuthHarnessEnabled()) return null;
  return buildHarnessCredentials();
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const target = safeTrim(email).toLowerCase();
  if (!target) return null;

  const admin = supabaseAdmin();
  for (let page = 1; page <= REMOTE_BACKEND_AUTH_HARNESS_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: REMOTE_BACKEND_AUTH_HARNESS_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Kunne ikke lese auth-brukere for remote harness: ${error.message}`);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((user) => safeTrim(user.email).toLowerCase() === target);
    if (match?.id) return match.id;
    if (users.length < REMOTE_BACKEND_AUTH_HARNESS_PAGE_SIZE) break;
  }

  return null;
}

async function upsertHarnessUser(credentials: RemoteBackendAuthHarnessCredentials) {
  const admin = supabaseAdmin();
  const existingUserId = await findAuthUserIdByEmail(credentials.email);

  if (existingUserId) {
    const { error } = await admin.auth.admin.updateUserById(existingUserId, {
      password: credentials.password,
      email_confirm: true,
      user_metadata: {
        lp_remote_backend_auth_harness: true,
      },
    });

    if (error) {
      throw new Error(`Kunne ikke oppdatere remote harness-bruker: ${error.message}`);
    }

    return { userId: existingUserId, created: false } as const;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
    user_metadata: {
      lp_remote_backend_auth_harness: true,
    },
  });

  if (!error && data?.user?.id) {
    return { userId: data.user.id, created: true } as const;
  }

  const message = safeTrim(error?.message).toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    const recoveredUserId = await findAuthUserIdByEmail(credentials.email);
    if (recoveredUserId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(recoveredUserId, {
        password: credentials.password,
        email_confirm: true,
        user_metadata: {
          lp_remote_backend_auth_harness: true,
        },
      });

      if (updateError) {
        throw new Error(`Kunne ikke oppdatere eksisterende remote harness-bruker: ${updateError.message}`);
      }

      return { userId: recoveredUserId, created: false } as const;
    }
  }

  throw new Error(`Kunne ikke opprette remote harness-bruker: ${error?.message ?? "ukjent feil"}`);
}

export async function ensureRemoteBackendAuthHarnessUser():
  Promise<
    | { ok: true; email: string; userId: string; created: boolean }
    | { ok: false; reason: "disabled" | "missing_admin_config" }
  > {
  if (!isHarnessFlagEnabled() || getCmsRuntimeStatus().mode !== "remote_backend") {
    return { ok: false, reason: "disabled" };
  }

  if (!hasSupabaseAdminConfig()) {
    return { ok: false, reason: "missing_admin_config" };
  }

  const credentials = buildHarnessCredentials();
  const result = await upsertHarnessUser(credentials);

  return {
    ok: true,
    email: credentials.email,
    userId: result.userId,
    created: result.created,
  };
}
