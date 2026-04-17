// app/(app)/week/mine-lunsjendringer/page.tsx — read-only egne siste ordre-rader (canonical orders-tabell)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireActiveAgreement } from "@/lib/agreements/requireActiveAgreement";
import { readLocalDevAuthSession } from "@/lib/auth/devBypass";
import type { Role } from "@/lib/auth/role";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";
import { formatDateNO, formatTimeNO } from "@/lib/date/format";
import { loadEmployeeOwnLunchRecentHistory } from "@/lib/server/employee/loadEmployeeOwnLunchRecentHistory";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Mine lunsjendringer – Lunchportalen",
  description: "Les egne siste bestillingsrader fra operativ ordretabell. Kun visning.",
  robots: { index: false, follow: false },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function EmployeeMineLunsjendringerPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week/mine-lunsjendringer");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?next=/week/mine-lunsjendringer");
  }

  const authUserId = safeStr(data.user.id);
  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <h1 className="lp-h1">Mine lunsjendringer</h1>
        <p className="mt-4 text-sm text-neutral-700">Superadmin har ikke tilgang til denne siden.</p>
        <Link href="/superadmin" className="mt-6 inline-block text-sm font-semibold text-neutral-900 underline">
          Til superadmin
        </Link>
      </main>
    );
  }

  await requireActiveAgreement();

  const pRes = await sb.from("profiles").select("company_id,location_id").maybeSingle();
  if (pRes.error || !pRes.data?.company_id) {
    if (role === "employee") {
      redirect("/status?code=PROFILE_MISSING");
    }
    redirect("/status");
  }

  const companyId = safeStr(pRes.data.company_id);
  const locationId = pRes.data.location_id != null ? safeStr(pRes.data.location_id) : null;

  const hist = await loadEmployeeOwnLunchRecentHistory({
    userId: authUserId,
    companyId,
    locationId: locationId || null,
  });

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Mine lunsjendringer</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Dine siste rader fra den operative ordretabellen (samme kilder som ukeplanen). Kun egne bestillinger for ditt firma
        {locationId ? " og din lokasjon" : ""}.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Ukeplan
        </Link>
        <Link href="/week/min-dag" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Min dag
        </Link>
        <Link href="/week/tidligere-lunsjdager" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Tidligere lunsjdager
        </Link>
        <Link href="/week/mine-registrerte-dager" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Mine registrerte dager
        </Link>
        <Link href="/week/bestillingsprofil" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Bestillingsprofil
        </Link>
        <Link href="/orders" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Bestillinger
        </Link>
        <Link href="/week/tidligere-lunsjdager" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Tidligere lunsjdager
        </Link>
      </div>

      {hist.warning_nb ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {hist.warning_nb}
        </div>
      ) : null}

      {hist.items.length === 0 && !hist.warning_nb ? (
        <p className="mx-auto mt-8 max-w-md text-center text-sm text-neutral-700">
          Ingen registrerte ordreendringer funnet ennå. Når du bestiller eller avbestiller i ukeplanen, vises radene her.
        </p>
      ) : null}

      {hist.items.length > 0 ? (
        <ul className="mx-auto mt-8 w-full max-w-md space-y-4 text-left sm:max-w-2xl">
          {hist.items.map((it) => (
            <li key={it.order_id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
              <div className="text-center sm:text-left">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Ordre</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">{it.title_nb}</div>
                <p className="mt-2 text-sm text-neutral-800">{it.body_nb}</p>
                <div className="mt-2 text-xs text-neutral-600">
                  Sortert etter sist oppdatert:{" "}
                  <span className="font-mono">
                    {formatDateNO(it.sort_at.slice(0, 10))} kl. {formatTimeNO(it.sort_at)}
                  </span>
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href={`/week/ordre/${encodeURIComponent(it.delivery_date_iso)}`}
                    className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
                  >
                    Ordredetalj for leveringsdato
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
