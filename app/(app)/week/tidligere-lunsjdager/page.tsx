// app/(app)/week/tidligere-lunsjdager/page.tsx — read-only egne tidligere lunsjdager (operativ orders, før dagens Oslo-dato)
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
import { formatDateNO, formatTimeNO, formatWeekdayNO } from "@/lib/date/format";
import { osloTodayISODate } from "@/lib/date/oslo";
import { groupEmployeePastLunchByWeekDescending } from "@/lib/employee/tidligereLunsjdagerGroup";
import { loadEmployeePastLunchDayHistory } from "@/lib/server/employee/loadEmployeeOwnLunchRecentHistory";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Tidligere lunsjdager – Lunchportalen",
  description: "Les egne tidligere bestillingsdager fra operativ ordretabell. Kun visning.",
  robots: { index: false, follow: false },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function EmployeeTidligereLunsjdagerPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week/tidligere-lunsjdager");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?next=/week/tidligere-lunsjdager");
  }

  const authUserId = safeStr(data.user.id);
  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <h1 className="lp-h1">Tidligere lunsjdager</h1>
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

  const hist = await loadEmployeePastLunchDayHistory({
    userId: authUserId,
    companyId,
    locationId: locationId || null,
  });

  const todayIso = osloTodayISODate();
  const weekGroups = groupEmployeePastLunchByWeekDescending(hist.items);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Tidligere lunsjdager</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Dine tidligere dager med ordrelinje i den operative ordretabellen (leveringsdato før {formatDateNO(todayIso)}). Samme
        scoping som ukeplan og «Mine lunsjendringer» — kun egne rader for ditt firma
        {locationId ? " og din lokasjon" : ""}.
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-neutral-600">
        Dager uten rad her er ikke nødvendigvis «uten lunsj» — listen viser kun datoer der det finnes en ordrekonsekvens i
        systemet. For synlig vindu inkludert kommende dager, bruk «Min dag» og ukeplanen.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Ukeplan
        </Link>
        <Link href="/week/min-dag" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Min dag
        </Link>
        <Link href="/week/mine-lunsjendringer" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Mine lunsjendringer
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
        <Link href={`/week/ordre/${encodeURIComponent(osloTodayISODate())}`} className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Ordre i dag
        </Link>
      </div>

      {hist.warning_nb ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {hist.warning_nb}
        </div>
      ) : null}

      {hist.items.length === 0 && !hist.warning_nb ? (
        <p className="mx-auto mt-8 max-w-md text-center text-sm text-neutral-700">
          Ingen tidligere ordrelinjer funnet ennå. Når du har hatt bestillinger på datoer før i dag, vises de her gruppert
          etter uke.
        </p>
      ) : null}

      {weekGroups.length > 0 ? (
        <div className="mx-auto mt-8 w-full max-w-md space-y-8 text-left sm:max-w-2xl">
          {weekGroups.map((g) => (
            <section key={g.weekStartIso} className="space-y-3">
              <h2 className="text-center text-sm font-semibold text-neutral-900">
                Uke fra {formatDateNO(g.weekStartIso)} · {formatWeekdayNO(g.weekStartIso)}
              </h2>
              <ul className="space-y-4">
                {g.items.map((it) => {
                  const wk = formatWeekdayNO(it.delivery_date_iso);
                  return (
                    <li key={it.order_id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
                      <div className="text-center sm:text-left">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Dag</div>
                        <div className="mt-1 text-base font-semibold text-neutral-900">
                          {formatDateNO(it.delivery_date_iso)}
                          {wk ? ` · ${wk}` : null}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-neutral-900">{it.title_nb}</div>
                        {it.slot_label_nb ? (
                          <p className="mt-1 text-sm text-neutral-700">
                            Vindu: <span className="font-mono text-xs">{it.slot_label_nb}</span>
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm text-neutral-800">{it.body_nb}</p>
                        <div className="mt-2 text-xs text-neutral-600">
                          Sist oppdatert i ordre:{" "}
                          <span className="font-mono">
                            {formatDateNO(it.sort_at.slice(0, 10))} kl. {formatTimeNO(it.sort_at)}
                          </span>
                        </div>
                        <div className="mt-3 text-center">
                          <Link
                            href={`/week/ordre/${encodeURIComponent(it.delivery_date_iso)}`}
                            className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
                          >
                            Ordredetalj for dagen
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </main>
  );
}
