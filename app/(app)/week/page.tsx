// app/(app)/week/page.tsx — employee ukevisning: meny fra /api/order/window, bestill/avbestill via /api/order/set-day
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import EmployeeWeekClient from "./EmployeeWeekClient";

import { requireActiveAgreement } from "@/lib/agreements/requireActiveAgreement";
import { readLocalDevAuthSession } from "@/lib/auth/devBypass";
import type { Role } from "@/lib/auth/role";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Ukeplan – Lunchportalen",
  description: "Se meny og bestill lunsj. Avbestilling og nye bestillinger stenger kl. 08:00 samme dag (Oslo).",
  robots: { index: false, follow: false },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function computeBillingHold(company: any | null): { canAct: boolean; reason: string | null } {
  if (!company) return { canAct: false, reason: "Kan ikke verifisere firmastatus." };

  const status = String(company.status ?? "").toUpperCase();
  if (status && status !== "ACTIVE") {
    if (status === "PAUSED") return { canAct: false, reason: "Bestilling er midlertidig pauset for firma." };
    if (status === "CLOSED") return { canAct: false, reason: "Firma er stengt. Bestilling er låst." };
    if (status === "PENDING") return { canAct: false, reason: "Firma er ikke aktivert ennå." };
    return { canAct: false, reason: "Bestilling er låst pga firmastatus." };
  }

  const hold =
    Boolean(company.billing_hold) || Boolean(company.hold_active) || Boolean(company.payment_hold);

  if (hold) {
    const msg =
      safeStr(company.billing_hold_reason) ||
      safeStr(company.hold_reason) ||
      "Bestilling er midlertidig låst for firma.";
    return { canAct: false, reason: msg };
  }

  return { canAct: true, reason: null };
}

async function adminClientOrNull() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
}

export default async function EmployeeWeekPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();

  if (error || !data?.user) {
    redirect("/login?next=/week");
  }

  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as any)?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <>
        <h1 className="lp-h1 text-center pt-6">Ukeplan</h1>
        <div className="mx-auto mt-6 max-w-lg px-4 text-center text-sm text-neutral-700">
          <p>Superadmin bruker systemflaten — ikke ansatt ukevisning.</p>
          <p className="mt-4">
            <Link href="/superadmin" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
              Gå til systemadministrasjon
            </Link>
          </p>
        </div>
      </>
    );
  }

  await requireActiveAgreement();

  const pRes = await sb.from("profiles").select("company_id,location_id").maybeSingle();
  if (pRes.error || !pRes.data?.company_id) {
    if (role === "employee") {
      redirect("/status?code=PROFILE_MISSING");
    }
    return (
      <>
        <h1 className="lp-h1 text-center pt-6">Ukeplan</h1>
        <p className="mx-auto mt-2 max-w-lg px-4 text-center text-sm text-neutral-600">
          Forhåndsvalgt meny etter avtale. Avbestilling og nye bestillinger stenger kl. 08:00 samme dag (Oslo).
        </p>
        <p className="mx-auto mt-3 max-w-lg px-4 text-center text-sm">
          <Link href="/week/min-dag" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Min dag — status og synlige dager
          </Link>
          {" · "}
          <Link href="/week/mine-lunsjendringer" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Mine lunsjendringer
          </Link>
          {" · "}
          <Link href="/week/tidligere-lunsjdager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Tidligere lunsjdager
          </Link>
          {" · "}
          <Link href="/week/mine-registrerte-dager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Mine registrerte dager
          </Link>
          {" · "}
          <Link href="/week/bestillingsprofil" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Bestillingsprofil
          </Link>
        </p>
        <EmployeeWeekClient canAct={false} billingHoldReason={null} />
      </>
    );
  }

  const companyId = String(pRes.data.company_id);

  const admin = await adminClientOrNull();
  if (!admin) {
    return (
      <>
        <h1 className="lp-h1 text-center pt-6">Ukeplan</h1>
        <p className="mx-auto mt-3 max-w-lg px-4 text-center text-sm">
          <Link href="/week/min-dag" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Min dag — status og synlige dager
          </Link>
          {" · "}
          <Link href="/week/mine-lunsjendringer" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Mine lunsjendringer
          </Link>
          {" · "}
          <Link href="/week/tidligere-lunsjdager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Tidligere lunsjdager
          </Link>
          {" · "}
          <Link href="/week/mine-registrerte-dager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Mine registrerte dager
          </Link>
          {" · "}
          <Link href="/week/bestillingsprofil" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Bestillingsprofil
          </Link>
        </p>
        <EmployeeWeekClient canAct={false} billingHoldReason="Mangler service-konfigurasjon for firmaverifisering." />
      </>
    );
  }

  const cRes = await admin
    .from("companies")
    .select("id,status,billing_hold,billing_hold_reason,hold_active,hold_reason,payment_hold")
    .eq("id", companyId)
    .maybeSingle();

  if (cRes.error || !cRes.data) {
    return (
      <>
        <h1 className="lp-h1 text-center pt-6">Ukeplan</h1>
        <p className="mx-auto mt-3 max-w-lg px-4 text-center text-sm">
          <Link href="/week/min-dag" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Min dag — status og synlige dager
          </Link>
          {" · "}
          <Link href="/week/mine-lunsjendringer" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Mine lunsjendringer
          </Link>
          {" · "}
          <Link href="/week/tidligere-lunsjdager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Tidligere lunsjdager
          </Link>
          {" · "}
          <Link href="/week/mine-registrerte-dager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Mine registrerte dager
          </Link>
          {" · "}
          <Link href="/week/bestillingsprofil" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
            Bestillingsprofil
          </Link>
        </p>
        <EmployeeWeekClient canAct={false} billingHoldReason="Kan ikke verifisere firmastatus akkurat nå." />
      </>
    );
  }

  const hold = computeBillingHold(cRes.data);

  return (
    <>
      <h1 className="lp-h1 text-center pt-6">Ukeplan</h1>
      <p className="mx-auto mt-2 max-w-lg px-4 text-center text-sm text-neutral-600">
        Forhåndsvalgt meny etter avtale. Bestilling og avbestilling stenger kl. 08:00 samme dag (Oslo).
      </p>
      <p className="mx-auto mt-3 max-w-lg px-4 text-center text-sm">
        <Link href="/week/min-dag" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
          Min dag — status og synlige dager
        </Link>
        {" · "}
        <Link href="/week/mine-lunsjendringer" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
          Mine lunsjendringer
        </Link>
        {" · "}
        <Link href="/week/tidligere-lunsjdager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
          Tidligere lunsjdager
        </Link>
        {" · "}
        <Link href="/week/mine-registrerte-dager" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
          Mine registrerte dager
        </Link>
        {" · "}
        <Link href="/week/bestillingsprofil" className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4">
          Bestillingsprofil
        </Link>
      </p>
      <EmployeeWeekClient canAct={hold.canAct} billingHoldReason={hold.reason} />
    </>
  );
}
