"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import {
  completeTripletexConnectionAfterVerify,
  testAndRecordTripletexToken,
  verifyTripletexEmployeeToken,
  type TripletexTokenVerificationResult,
} from "@/lib/integrations/tripletex/onboardingVerify";
import { buildProviderTripletexWebhookUrl } from "@/lib/integrations/tripletex/providerWebhookUrl";
import { resolveTripletexProviderEnv } from "@/lib/integrations/tripletex/resolveTripletexProviderEnv";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type WizardActionError = { ok: false; error: string; code?: string };
export type WizardActionOk<T> = { ok: true; data: T };

export type ConnectionHealthSummary = {
  state: string;
  provisioningComplete: boolean;
  tripletexCompanyName: string | null;
  stats30d: Record<string, number>;
  recentEvents: Array<{ action: string; created_at: string }>;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function maskTokenForLog(token: string): string {
  const t = safeStr(token);
  if (t.length <= 4) return "tok_****";
  return `tok_***${t.slice(-4)}`;
}

async function requireProviderAdmin(providerId: string): Promise<WizardActionError | null> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, error: "Ikke innlogget.", code: "UNAUTHENTICATED" };
  }

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) {
    return { ok: false as const, error: "Kun provider-admin kan koble til Tripletex.", code: "FORBIDDEN" };
  }

  return null;
}

function parseCompanyId(raw: string): number | null {
  const digits = safeStr(raw).replace(/\s+/g, "");
  if (!/^\d{6,12}$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function verifyTokenAction(input: {
  providerId: string;
  tripletexCompanyId: string;
  employeeToken: string;
}): Promise<WizardActionOk<TripletexTokenVerificationResult> | WizardActionError> {
  const denied = await requireProviderAdmin(input.providerId);
  if (denied) return denied;

  const companyId = parseCompanyId(input.tripletexCompanyId);
  if (!companyId) {
    return { ok: false as const, error: "Company ID må være 6–12 siffer.", code: "INVALID_COMPANY_ID" };
  }

  const employeeToken = safeStr(input.employeeToken);
  if (!employeeToken) {
    return { ok: false as const, error: "Employee Token er påkrevd.", code: "INVALID_TOKEN" };
  }

  const env = resolveTripletexProviderEnv();

  try {
    const result = await verifyTripletexEmployeeToken({
      employeeToken,
      expectedCompanyId: companyId,
    });

    const admin = supabaseAdmin();
    await testAndRecordTripletexToken(admin, {
      providerId: input.providerId,
      env,
      tripletexCompanyId: companyId,
      employeeToken,
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[tripletex-wizard] verify", {
        provider_id: input.providerId,
        token: maskTokenForLog(employeeToken),
        all_passed: result.all_passed,
      });
    }

    return { ok: true as const, data: result };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: safeStr((error as Error)?.message ?? error) || "Verifisering feilet.",
      code: "VERIFY_FAILED",
    };
  }
}

export async function completeConnectionAction(input: {
  providerId: string;
  tripletexCompanyId: string;
  employeeToken: string;
}): Promise<WizardActionOk<{ connection_state: string }> | WizardActionError> {
  const denied = await requireProviderAdmin(input.providerId);
  if (denied) return denied;

  const companyId = parseCompanyId(input.tripletexCompanyId);
  if (!companyId) {
    return { ok: false as const, error: "Company ID må være 6–12 siffer.", code: "INVALID_COMPANY_ID" };
  }

  const employeeToken = safeStr(input.employeeToken);
  if (!employeeToken) {
    return { ok: false as const, error: "Employee Token er påkrevd.", code: "INVALID_TOKEN" };
  }

  const env = resolveTripletexProviderEnv();

  try {
    const verificationResult = await verifyTripletexEmployeeToken({
      employeeToken,
      expectedCompanyId: companyId,
    });

    if (!verificationResult.all_passed) {
      return {
        ok: false as const,
        error: "Verifisering feilet. Token eller tilganger er ikke gyldige.",
        code: "VERIFICATION_FAILED",
      };
    }

    const admin = supabaseAdmin();
    const data = await completeTripletexConnectionAfterVerify(admin, {
      providerId: input.providerId,
      env,
      tripletexCompanyId: companyId,
      employeeToken,
      verificationResult,
    });

    revalidatePath("/leverandor/innstillinger/tripletex/koble-til");

    return {
      ok: true as const,
      data: {
        connection_state: safeStr((data as { connection_state?: string })?.connection_state) || "CONFIGURING",
      },
    };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: safeStr((error as Error)?.message ?? error) || "Kunne ikke lagre tilkoblingen.",
      code: "COMPLETE_FAILED",
    };
  }
}

export async function rotateWebhookSecretAction(input: {
  providerId: string;
}): Promise<
  WizardActionOk<{ webhook_secret: string; webhook_url: string }> | WizardActionError
> {
  const denied = await requireProviderAdmin(input.providerId);
  if (denied) return denied;

  const env = resolveTripletexProviderEnv();
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_provider_rotate_webhook_secret", {
    p_provider_id: input.providerId,
    p_env: env,
  });

  if (error) {
    return {
      ok: false as const,
      error: safeStr(error.message) || "Kunne ikke generere webhook-secret.",
      code: "ROTATE_FAILED",
    };
  }

  const secret = safeStr((data as { webhook_secret?: string })?.webhook_secret);
  if (!secret) {
    return { ok: false as const, error: "Webhook-secret mangler i svar.", code: "ROTATE_EMPTY" };
  }

  return {
    ok: true as const,
    data: {
      webhook_secret: secret,
      webhook_url: buildProviderTripletexWebhookUrl(input.providerId),
    },
  };
}

export async function finalizeConnectionAction(input: {
  providerId: string;
}): Promise<WizardActionOk<{ connection_state: string }> | WizardActionError> {
  const denied = await requireProviderAdmin(input.providerId);
  if (denied) return denied;

  const env = resolveTripletexProviderEnv();
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_provider_finalize_tripletex_connection", {
    p_provider_id: input.providerId,
    p_env: env,
  });

  if (error) {
    const msg = safeStr(error.message);
    if (msg.includes("PROVISIONING_NOT_COMPLETE")) {
      return { ok: false as const, error: "Oppsettet er ikke ferdig ennå.", code: "PROVISIONING_NOT_COMPLETE" };
    }
    if (msg.includes("WEBHOOK_SECRET_REQUIRED")) {
      return { ok: false as const, error: "Webhook-secret må genereres først.", code: "WEBHOOK_REQUIRED" };
    }
    return { ok: false as const, error: msg || "Kunne ikke fullføre tilkoblingen.", code: "FINALIZE_FAILED" };
  }

  revalidatePath("/leverandor/innstillinger/tripletex/koble-til");
  revalidatePath("/leverandor/innstillinger/tripletex/status");

  return {
    ok: true as const,
    data: {
      connection_state: safeStr((data as { connection_state?: string })?.connection_state) || "CONNECTED",
    },
  };
}

export async function getHealthAction(input: {
  providerId: string;
}): Promise<WizardActionOk<ConnectionHealthSummary> | WizardActionError> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, error: "Ikke innlogget.", code: "UNAUTHENTICATED" };
  }

  const allowed = await hasProviderRole(auth.user.id, input.providerId, "provider_admin");
  if (!allowed) {
    return { ok: false as const, error: "Kun provider-admin har tilgang.", code: "FORBIDDEN" };
  }

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

  const admin = supabaseAdmin();
  const { data: credRow } = await admin
    .from("provider_tripletex_credentials")
    .select("onboarding_provisioning_complete_at")
    .eq("provider_id", input.providerId)
    .maybeSingle();

  const h = (health ?? {}) as Record<string, unknown>;
  const stats = (h.stats_30d ?? {}) as Record<string, number>;
  const eventsRaw = Array.isArray(h.recent_events) ? h.recent_events : [];

  return {
    ok: true as const,
    data: {
      state: safeStr(h.state) || "NOT_CONNECTED",
      provisioningComplete: Boolean(credRow?.onboarding_provisioning_complete_at),
      tripletexCompanyName: safeStr(h.tripletex_company_name) || null,
      stats30d: stats,
      recentEvents: eventsRaw.map((ev) => {
        const row = ev as Record<string, unknown>;
        return {
          action: safeStr(row.action),
          created_at: safeStr(row.created_at),
        };
      }),
    },
  };
}
