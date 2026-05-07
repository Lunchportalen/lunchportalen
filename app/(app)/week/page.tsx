// app/(app)/week/page.tsx — employee ukevisning: meny fra /api/order/window, bestill/avbestill via /api/order/set-day
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
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

function WeekBrandMark() {
  return (
    <Link href="/" className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40">
      <Image
        src="/brand/LP-logo-uten-bakgrunn.png"
        alt="Lunchportalen"
        width={190}
        height={96}
        priority
        className="h-16 w-auto max-w-full object-contain md:h-24"
      />
    </Link>
  );
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
      <section className="mx-auto w-full max-w-2xl px-4 py-8 text-center">
        <WeekBrandMark />
        <div className="mt-5 rounded-[2rem] bg-white/90 px-5 py-7 shadow-[0_18px_60px_rgba(24,20,16,0.08)] ring-1 ring-black/10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Systemrolle</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950 md:text-4xl">
            Superadmin bruker systemflaten
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-neutral-600">
            Superadmin bruker systemflaten &mdash; ikke ansatt ukevisning.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/superadmin"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm"
            >
              G&aring; til systemadministrasjon
            </Link>
            <Link
              href="/kitchen"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 ring-1 ring-black/15"
            >
              Se kj&oslash;kkenoversikt
            </Link>
          </div>
        </div>
      </section>
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
      <section className="mx-auto w-full max-w-2xl px-4 pt-5 text-center">
        <WeekBrandMark />
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Ansattflate</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-neutral-950 md:text-5xl">
          Bestill eller avbestill lunsj
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-neutral-600">
          Frist for samme dags bestilling er 08:00.
        </p>
      </section>
      <EmployeeWeekClient canAct={hold.canAct} billingHoldReason={hold.reason} />
    </>
  );
}
