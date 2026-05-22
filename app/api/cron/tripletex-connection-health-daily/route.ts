export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  createTripletexAuthFromTokens,
  tripletexWhoAmI,
  TripletexClientError,
} from "@/lib/integrations/tripletex/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CredentialRow = {
  provider_id: string;
  env: "test" | "prod";
  connection_state: string;
  vault_purge_at: string | null;
  consumer_token_secret_id: string;
  employee_token_secret_id: string;
  company_id_external: number | null;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

async function writeHealthCronAudit(
  action: string,
  rid: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const admin = supabaseAdmin();
  await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action,
    entity_type: "tripletex_connection_health_cron",
    entity_id: rid,
    reason: null,
    metadata: { request_rid: rid, ...metadata },
  });
}

async function runWhoAmIHealthCheck(
  admin: ReturnType<typeof supabaseAdmin>,
  row: CredentialRow,
): Promise<{ ok: boolean; authFailed: boolean; companyName: string | null; skipped: boolean }> {
  const { data, error } = await admin.rpc("lp_provider_load_tripletex_credentials", {
    p_provider_id: row.provider_id,
    p_env: row.env,
  });

  if (error) {
    const message = safeStr((error as { message?: string })?.message ?? error);
    if (message.includes("PROVIDER_CREDENTIALS")) {
      return { ok: false, authFailed: true, companyName: null, skipped: false };
    }
    return { ok: false, authFailed: false, companyName: null, skipped: true };
  }

  const cred = (data ?? {}) as Record<string, unknown>;
  const consumer = safeStr(cred.consumer_token);
  const employee = safeStr(cred.employee_token);
  const companyId = safeStr(row.company_id_external ?? cred.company_id_external ?? "");

  if (!consumer || !employee || !companyId) {
    return { ok: false, authFailed: true, companyName: null, skipped: false };
  }

  try {
    const auth = await createTripletexAuthFromTokens({
      tripletexCompanyId: companyId,
      consumerToken: consumer,
      employeeToken: employee,
    });
    const who = await tripletexWhoAmI({ auth });
    return { ok: true, authFailed: false, companyName: who.companyName, skipped: false };
  } catch (error: unknown) {
    if (error instanceof TripletexClientError && (error.status === 401 || error.status === 403)) {
      return { ok: false, authFailed: true, companyName: null, skipped: false };
    }
    if (error instanceof TripletexClientError && error.kind === "TRANSIENT") {
      return { ok: false, authFailed: false, companyName: null, skipped: true };
    }
    return { ok: false, authFailed: false, companyName: null, skipped: true };
  }
}

async function handleConnectionHealthCron(req: NextRequest) {
  const rid = makeRid("cron_tpt_health");
  const started = Date.now();

  try {
    requireCronAuth(req);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    const code = String((e as { code?: string })?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, {
      code: "server_error",
      detail: { message: msg },
    });
  }

  const admin = supabaseAdmin();
  const summary = {
    checked: 0,
    recovered: 0,
    degraded: 0,
    skipped_transient: 0,
    purged: 0,
    grace_active: 0,
    errors: [] as string[],
  };

  try {
    const { data: rows, error } = await (admin as any)
      .from("provider_tripletex_credentials")
      .select("provider_id, env, connection_state, vault_purge_at, company_id_external")
      .in("connection_state", ["CONNECTED", "DEGRADED", "DISCONNECTED"]);

    if (error) {
      await writeHealthCronAudit("tripletex_connection_health_cron_failed", rid, {
        ok: false,
        message: safeStr(error.message),
      });
      return jsonErr(rid, "Kunne ikke lese provider_tripletex_credentials", 500, {
        code: "db_error",
        detail: { message: safeStr(error.message) },
      });
    }

    for (const raw of rows ?? []) {
      const row = raw as CredentialRow;

      if (row.connection_state === "DISCONNECTED") {
        const { data: purgeData, error: purgeError } = await admin.rpc(
          "lp_provider_purge_disconnected_vault",
          { p_provider_id: row.provider_id, p_env: row.env },
        );

        if (purgeError) {
          summary.errors.push(`${row.provider_id}: purge ${safeStr(purgeError.message)}`);
          continue;
        }

        const purged = Boolean((purgeData as { purged?: boolean })?.purged);
        if (purged) summary.purged += 1;
        else summary.grace_active += 1;
        continue;
      }

      if (row.connection_state !== "CONNECTED" && row.connection_state !== "DEGRADED") {
        continue;
      }

      summary.checked += 1;
      const check = await runWhoAmIHealthCheck(admin, row);

      if (check.skipped) {
        summary.skipped_transient += 1;
        continue;
      }

      const { data: applyData, error: applyError } = await admin.rpc(
        "lp_provider_apply_connection_health_check",
        {
          p_provider_id: row.provider_id,
          p_env: row.env,
          p_ok: check.ok,
          p_auth_failed: check.authFailed,
          p_company_name: check.companyName,
        },
      );

      if (applyError) {
        summary.errors.push(`${row.provider_id}: apply ${safeStr(applyError.message)}`);
        continue;
      }

      const transitioned = safeStr((applyData as { transitioned_to?: string })?.transitioned_to);
      if (transitioned === "DEGRADED") summary.degraded += 1;
      if (transitioned === "CONNECTED") summary.recovered += 1;
    }

    await writeHealthCronAudit("tripletex_connection_health_cron_completed", rid, {
      ok: true,
      duration_ms: Date.now() - started,
      ...summary,
    });

    return jsonOk(rid, {
      ok: true,
      rid,
      duration_ms: Date.now() - started,
      ...summary,
    });
  } catch (e: unknown) {
    const message = safeStr((e as Error)?.message ?? e);
    captureCronHandlerError("/api/cron/tripletex-connection-health-daily", rid, e);
    await writeHealthCronAudit("tripletex_connection_health_cron_failed", rid, {
      ok: false,
      duration_ms: Date.now() - started,
      message,
    }).catch(() => undefined);

    return jsonOk(rid, {
      ok: false,
      rid,
      duration_ms: Date.now() - started,
      message,
      ...summary,
    });
  }
}

export async function GET(req: NextRequest) {
  return handleConnectionHealthCron(req);
}

export async function POST(req: NextRequest) {
  return handleConnectionHealthCron(req);
}
