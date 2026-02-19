// app/(portal)/week/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import WeekClient from "./WeekClient";

import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

export const metadata: Metadata = {
  title: "Ukeplan – Lunchportalen",
  description: "Bestill eller avbestill lunsj for uken. Cut-off kl. 08:00 samme dag.",
  robots: { index: false, follow: false },
};

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers (fail-closed)
========================================================= */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeRole(v: unknown): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin" || s === "super_admin") return "superadmin";
  if (s === "kitchen" || s === "kjokken") return "kitchen";
  if (s === "driver" || s === "sjafor") return "driver";
  return "employee";
}

async function adminClientOrNull() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
}

/**
 * Billing hold model is implementation-specific.
 * We attempt to detect hold via (A) companies.status != ACTIVE OR (B) known hold flag fields if present.
 * If schema doesn't have hold fields yet, this is safe: it defaults to canAct=true for ACTIVE companies.
 */
function computeBillingHold(
  company: any | null
): { canAct: boolean; reason: string | null } {
  if (!company) return { canAct: false, reason: "Kan ikke verifisere firmastatus." };

  const status = String(company.status ?? "").toUpperCase();
  if (status && status !== "ACTIVE") {
    if (status === "PAUSED") return { canAct: false, reason: "Bestilling er midlertidig pauset for firma." };
    if (status === "CLOSED") return { canAct: false, reason: "Firma er stengt. Bestilling/avbestilling er låst." };
    if (status === "PENDING") return { canAct: false, reason: "Firma er ikke aktivert ennå." };
    return { canAct: false, reason: "Bestilling er låst pga firmastatus." };
  }

  // Optional hold flags (if you add them later)
  const hold =
    Boolean(company.billing_hold) ||
    Boolean(company.hold_active) ||
    Boolean(company.payment_hold);

  if (hold) {
    const msg =
      safeStr(company.billing_hold_reason) ||
      safeStr(company.hold_reason) ||
      "Bestilling er midlertidig låst for firma (betalingsoppfølging).";
    return { canAct: false, reason: msg };
  }

  return { canAct: true, reason: null };
}

export default async function WeekPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();

  // Fail-closed: must be logged in
  if (error || !data?.user) {
    redirect("/login?next=/week");
  }

  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRole((data.user.user_metadata as any)?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  // Hard-route system roles away (safety)
  if (role === "superadmin") redirect("/superadmin");
  if (role === "kitchen") redirect("/kitchen");
  if (role === "driver") redirect("/driver");

  // (portal) allows employee + company_admin only
  if (role !== "employee" && role !== "company_admin") {
    redirect("/status?code=ROLE_BLOCKED");
  }

  // Determine company_id from RLS-safe profiles (single source)
  const pRes = await sb.from("profiles").select("company_id,location_id,role,active").maybeSingle();
  if (pRes.error || !pRes.data?.company_id) {
    // Fail-closed: profile must exist
    redirect("/status?code=PROFILE_MISSING");
  }

  const companyId = String(pRes.data.company_id);

  // Service role lookup for company status/hold (fail-closed if admin missing)
  const admin = await adminClientOrNull();
  if (!admin) {
    // We can still allow read-only UI, but we do not allow writes without enforcement config.
    return <WeekClient canAct={false} billingHoldReason="Mangler service-konfigurasjon for firmaverifisering." />;
  }

  // Try to fetch company status + optional hold fields (select only what exists in your schema)
  // If you don't have billing_hold fields, this still works (they'll be null/undefined).
  const cRes = await admin
    .from("companies")
    .select("id,status,billing_hold,billing_hold_reason,hold_active,hold_reason,payment_hold")
    .eq("id", companyId)
    .maybeSingle();

  if (cRes.error || !cRes.data) {
    return <WeekClient canAct={false} billingHoldReason="Kan ikke verifisere firmastatus akkurat nå." />;
  }

  const hold = computeBillingHold(cRes.data);

  return <WeekClient canAct={hold.canAct} billingHoldReason={hold.reason} />;
}
