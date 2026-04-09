// lib/saas/onboarding.ts
// Not duplicate of POST /api/onboarding/complete — SaaS tenant bootstrap (billing) only.
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createStripeCustomerForCompany, ensureSubscriptionRow, stripeSecretKeyConfigured } from "@/lib/saas/billing";

export type OnboardingInput = {
  userId: string;
  email: string | null;
  companyName: string;
};

export type OnboardingResult =
  | {
      ok: true;
      companyId: string;
      redirectTo: string;
      stripeCustomerCreated: boolean;
    }
  | { ok: false; code: string; message: string };

function trimName(v: string): string {
  return String(v ?? "").trim();
}

/**
 * Creates a new company (ACTIVE — avoids PENDING registration field constraints),
 * assigns the user as company_admin, ensures a saas_subscriptions row (no Stripe).
 */
export async function createCompanyAndAssignAdmin(input: OnboardingInput): Promise<OnboardingResult> {
  const name = trimName(input.companyName);
  if (name.length < 2) {
    return { ok: false, code: "INVALID_NAME", message: "Firmanavn er ugyldig." };
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return { ok: false, code: "CONFIG_ERROR", message: "Tjenesten er ikke konfigurert (admin)." };
  }

  const { data: profile, error: pErr } = await admin.from("profiles").select("id, company_id, role").eq("id", input.userId).maybeSingle();
  if (pErr || !profile) {
    return { ok: false, code: "PROFILE_NOT_FOUND", message: "Profil ikke funnet." };
  }
  if (profile.company_id) {
    return { ok: false, code: "ALREADY_ONBOARDED", message: "Bruker er allerede knyttet til et firma." };
  }
  const role = String(profile.role ?? "").toLowerCase();
  if (role === "superadmin" || role === "kitchen" || role === "driver") {
    return { ok: false, code: "ROLE_NOT_ALLOWED", message: "Denne rollen kan ikke opprette SaaS-firma her." };
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .insert({
      name,
      status: "ACTIVE",
      saas_plan: "none",
    })
    .select("id")
    .single();

  if (cErr || !company?.id) {
    return { ok: false, code: "COMPANY_CREATE_FAILED", message: "Kunne ikke opprette firma." };
  }

  const companyId = company.id as string;

  const { error: uErr } = await admin
    .from("profiles")
    .update({
      company_id: companyId,
      role: "company_admin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (uErr) {
    await admin.from("companies").delete().eq("id", companyId);
    return { ok: false, code: "PROFILE_UPDATE_FAILED", message: "Kunne ikke knytte bruker til firma." };
  }

  await ensureSubscriptionRow({ companyId, stripeCustomerId: null, plan: "none" });

  return {
    ok: true,
    companyId,
    redirectTo: "/api/auth/post-login?next=/admin/dashboard",
    stripeCustomerCreated: false,
  };
}

/** Full onboarding: tenant row + Stripe customer when keys are configured. */
export async function runOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const base = await createCompanyAndAssignAdmin(input);
  if (!base.ok) return base;

  let stripeCustomerCreated = false;
  if (stripeSecretKeyConfigured()) {
    const cust = await createStripeCustomerForCompany({
      companyId: base.companyId,
      companyName: trimName(input.companyName),
      email: input.email,
    });
    if ("customerId" in cust) {
      await ensureSubscriptionRow({ companyId: base.companyId, stripeCustomerId: cust.customerId, plan: "none" });
      stripeCustomerCreated = true;
    }
  }

  return {
    ok: true,
    companyId: base.companyId,
    redirectTo: base.redirectTo,
    stripeCustomerCreated,
  };
}
