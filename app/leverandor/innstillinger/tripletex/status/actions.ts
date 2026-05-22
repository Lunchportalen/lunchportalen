"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { canAccessProvider, hasProviderRole } from "@/lib/auth/provider";
import {
  testAndRecordTripletexToken,
  verifyTripletexEmployeeToken,
  type TripletexTokenVerificationResult,
} from "@/lib/integrations/tripletex/onboardingVerify";
import { buildProviderTripletexWebhookUrl } from "@/lib/integrations/tripletex/providerWebhookUrl";
import { resolveTripletexProviderEnv } from "@/lib/integrations/tripletex/resolveTripletexProviderEnv";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type StatusActionError = { ok: false; error: string; code?: string };
export type StatusActionOk<T> = { ok: true; data: T };

export type DashboardWarning = { code: string; message: string };

export type DashboardActivityEvent = {
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type DashboardData = {
  state: string;
  stateSince: string | null;
  tripletexCompanyId: number | null;
  tripletexCompanyName: string | null;
  lastHealthCheck: string | null;
  provisioningComplete: boolean;
  vaultPurgeAt: string | null;
  daysUntilPurge: number | null;
  stats30d: {
    invoices_sent: number;
    invoices_paid: number;
    worker_failures: number;
    webhook_events: number;
  };
  resourceCounts: {
    products: number;
    customers: number;
    vatCodes: number;
  };
  webhook: {
    url: string;
    lastReceivedAt: string | null;
    events30d: number;
    lastRotatedAt: string | null;
  };
  recentEvents: DashboardActivityEvent[];
  warnings: DashboardWarning[];
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function requireProviderRead(providerId: string): Promise<StatusActionError | null> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, error: "Ikke innlogget.", code: "UNAUTHENTICATED" };
  }

  const allowed = await canAccessProvider(auth.user.id, providerId);
  if (!allowed) {
    return { ok: false as const, error: "Ingen tilgang til denne leverandøren.", code: "FORBIDDEN" };
  }

  return null;
}

async function requireProviderAdminOrSuperadmin(providerId: string): Promise<StatusActionError | null> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, error: "Ikke innlogget.", code: "UNAUTHENTICATED" };
  }

  if (await isSuperadminProfile(auth.user.id)) return null;

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) {
    return {
      ok: false as const,
      error: "Kun provider-admin kan utføre denne handlingen.",
      code: "FORBIDDEN",
    };
  }

  return null;
}

function parseHealthPayload(health: unknown): Omit<
  DashboardData,
  "provisioningComplete" | "vaultPurgeAt" | "daysUntilPurge" | "resourceCounts" | "webhook"
> {
  const h = (health ?? {}) as Record<string, unknown>;
  const stats = (h.stats_30d ?? {}) as Record<string, unknown>;
  const eventsRaw = Array.isArray(h.recent_events) ? h.recent_events : [];
  const warningsRaw = Array.isArray(h.warnings) ? h.warnings : [];

  return {
    state: safeStr(h.state) || "NOT_CONNECTED",
    stateSince: safeStr(h.state_since) || null,
    tripletexCompanyId: safeNum(h.tripletex_company_id),
    tripletexCompanyName: safeStr(h.tripletex_company_name) || null,
    lastHealthCheck: safeStr(h.last_health_check) || null,
    stats30d: {
      invoices_sent: safeNum(stats.invoices_sent) ?? 0,
      invoices_paid: safeNum(stats.invoices_paid) ?? 0,
      worker_failures: safeNum(stats.worker_failures) ?? 0,
      webhook_events: safeNum(stats.webhook_events) ?? 0,
    },
    recentEvents: eventsRaw.map((ev) => {
      const row = ev as Record<string, unknown>;
      const meta = row.metadata;
      return {
        action: safeStr(row.action),
        created_at: safeStr(row.created_at),
        metadata:
          meta && typeof meta === "object" && !Array.isArray(meta)
            ? (meta as Record<string, unknown>)
            : null,
      };
    }),
    warnings: warningsRaw.map((w) => {
      const row = w as Record<string, unknown>;
      return {
        code: safeStr(row.code),
        message: safeStr(row.message),
      };
    }),
  };
}

export async function getDashboardDataAction(input: {
  providerId: string;
}): Promise<StatusActionOk<DashboardData> | StatusActionError> {
  const denied = await requireProviderRead(input.providerId);
  if (denied) return denied;

  const env = resolveTripletexProviderEnv();
  const sb = await supabaseServer();

  const { data: health, error } = await sb.rpc("lp_provider_get_connection_health", {
    p_provider_id: input.providerId,
    p_env: env,
  });

  if (error) {
    return {
      ok: false as const,
      error: safeStr(error.message) || "Kunne ikke hente tilkoblingsstatus.",
      code: "HEALTH_FAILED",
    };
  }

  const base = parseHealthPayload(health);
  const admin = supabaseAdmin() as any;
  const sbAny = sb as any;

  const [credRes, productsCountRes, productsVatRes, customersRes, webhookMetaRes, lastWebhookRes] =
    await Promise.all([
    admin
      .from("provider_tripletex_credentials")
      .select("onboarding_provisioning_complete_at, vault_purge_at")
      .eq("provider_id", input.providerId)
      .maybeSingle(),
    admin
      .from("provider_tripletex_products")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", input.providerId)
      .eq("env", env),
    admin
      .from("provider_tripletex_products")
      .select("tripletex_vat_code")
      .eq("provider_id", input.providerId)
      .eq("env", env),
    admin
      .from("tripletex_customers")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", input.providerId),
    sbAny
      .from("provider_tripletex_webhook_secrets")
      .select("last_rotated_at")
      .eq("provider_id", input.providerId)
      .eq("env", env)
      .maybeSingle(),
    admin
      .from("tripletex_webhook_events")
      .select("received_at")
      .eq("provider_id", input.providerId)
      .eq("env", env)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const vatCodes = new Set<string>();
  if (Array.isArray(productsVatRes.data)) {
    for (const row of productsVatRes.data) {
      const code = safeStr((row as { tripletex_vat_code?: string }).tripletex_vat_code);
      if (code) vatCodes.add(code);
    }
  }

  const vaultPurgeAt = safeStr(credRes.data?.vault_purge_at) || null;
  let daysUntilPurge: number | null = null;
  if (vaultPurgeAt) {
    const purgeMs = new Date(vaultPurgeAt).getTime();
    if (Number.isFinite(purgeMs)) {
      daysUntilPurge = Math.max(0, Math.ceil((purgeMs - Date.now()) / 86_400_000));
    }
  }

  return {
    ok: true as const,
    data: {
      ...base,
      provisioningComplete: Boolean(credRes.data?.onboarding_provisioning_complete_at),
      vaultPurgeAt,
      daysUntilPurge,
      resourceCounts: {
        products: productsCountRes.count ?? 0,
        customers: customersRes.count ?? 0,
        vatCodes: vatCodes.size,
      },
      webhook: {
        url: buildProviderTripletexWebhookUrl(input.providerId),
        lastReceivedAt: safeStr(lastWebhookRes.data?.received_at) || null,
        events30d: base.stats30d.webhook_events,
        lastRotatedAt: safeStr(webhookMetaRes.data?.last_rotated_at) || null,
      },
    },
  };
}

export async function testConnectionAction(input: {
  providerId: string;
}): Promise<StatusActionOk<TripletexTokenVerificationResult> | StatusActionError> {
  const denied = await requireProviderAdminOrSuperadmin(input.providerId);
  if (denied) return denied;

  const env = resolveTripletexProviderEnv();
  const admin = supabaseAdmin() as any;

  const { data: creds, error: loadError } = await admin.rpc("lp_provider_load_tripletex_credentials", {
    p_provider_id: input.providerId,
    p_env: env,
  });

  if (loadError) {
    return {
      ok: false as const,
      error: safeStr(loadError.message) || "Kunne ikke laste credentials.",
      code: "CREDENTIALS_LOAD_FAILED",
    };
  }

  const row = (creds ?? {}) as Record<string, unknown>;
  const employeeToken = safeStr(row.employee_token);
  const companyId = safeNum(row.company_id_external);

  if (!employeeToken || !companyId) {
    return {
      ok: false as const,
      error: "Tripletex-credentials er ikke konfigurert.",
      code: "CREDENTIALS_MISSING",
    };
  }

  try {
    const result = await verifyTripletexEmployeeToken({
      employeeToken,
      expectedCompanyId: companyId,
    });

    await testAndRecordTripletexToken(admin, {
      providerId: input.providerId,
      env,
      tripletexCompanyId: companyId,
      employeeToken,
    });

    revalidatePath("/leverandor/innstillinger/tripletex/status");

    return { ok: true as const, data: result };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: safeStr((error as Error)?.message ?? error) || "Tilkoblingstest feilet.",
      code: "TEST_FAILED",
    };
  }
}

export async function disconnectTripletexAction(input: {
  providerId: string;
}): Promise<
  StatusActionOk<{
    connection_state: string;
    vault_purge_at: string | null;
    days_until_purge: number | null;
  }> | StatusActionError
> {
  const denied = await requireProviderAdminOrSuperadmin(input.providerId);
  if (denied) return denied;

  const env = resolveTripletexProviderEnv();
  const sb = await supabaseServer();

  const { data, error } = await sb.rpc("lp_provider_disconnect_tripletex", {
    p_provider_id: input.providerId,
    p_env: env,
  });

  if (error) {
    const msg = safeStr(error.message);
    if (msg.includes("INVALID_STATE_FOR_DISCONNECT")) {
      return {
        ok: false as const,
        error: "Tilkoblingen kan ikke frakobles i nåværende tilstand.",
        code: "INVALID_STATE",
      };
    }
    return {
      ok: false as const,
      error: msg || "Kunne ikke koble fra Tripletex.",
      code: "DISCONNECT_FAILED",
    };
  }

  const row = (data ?? {}) as Record<string, unknown>;

  revalidatePath("/leverandor/innstillinger/tripletex/status");
  revalidatePath("/leverandor/innstillinger/tripletex/koble-til");

  return {
    ok: true as const,
    data: {
      connection_state: safeStr(row.connection_state) || "DISCONNECTED",
      vault_purge_at: safeStr(row.vault_purge_at) || null,
      days_until_purge: safeNum(row.days_until_purge),
    },
  };
}
