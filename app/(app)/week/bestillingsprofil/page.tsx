// app/(app)/week/bestillingsprofil/page.tsx — read-only enkel bestillingsprofil (operativ ordrehistorikk)
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
import {
  countVindusdagerUtenAktivEllerKansellertOrdre,
  sisteOppdaterteOrdreRad,
  summarizePastOrderItemsForProfil,
  type VindusdagProfilLite,
} from "@/lib/employee/employeeBestillingsprofilSummary";
import { fetchOrderWindowServerSide } from "@/lib/server/employee/fetchOrderWindowServerSide";
import {
  loadEmployeeOwnLunchRecentHistory,
  loadEmployeePastLunchDayHistory,
} from "@/lib/server/employee/loadEmployeeOwnLunchRecentHistory";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Bestillingsprofil – Lunchportalen",
  description: "Enkel oppsummering av egne ordredager fra operativ tabell. Kun visning.",
  robots: { index: false, follow: false },
};

const NYLIGE_RADER_MAKS = 10;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function EmployeeBestillingsprofilPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week/bestillingsprofil");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?next=/week/bestillingsprofil");
  }

  const authUserId = safeStr(data.user.id);
  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <h1 className="lp-h1">Bestillingsprofil</h1>
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

  const [past, recent, windowRes] = await Promise.all([
    loadEmployeePastLunchDayHistory({
      userId: authUserId,
      companyId,
      locationId: locationId || null,
    }),
    loadEmployeeOwnLunchRecentHistory({
      userId: authUserId,
      companyId,
      locationId: locationId || null,
    }),
    fetchOrderWindowServerSide({ weeks: 2, ridPrefix: "bestillingsprofil" }),
  ]);

  const pastSum = summarizePastOrderItemsForProfil(past.items);
  const sistOpp = sisteOppdaterteOrdreRad(recent.items);
  const nylige = recent.items.slice(0, NYLIGE_RADER_MAKS);

  const windowDays =
    windowRes.ok === true && Array.isArray(windowRes.data.days) ? (windowRes.data.days as VindusdagProfilLite[]) : [];
  const vinduUtenAktivEllerKansellert = countVindusdagerUtenAktivEllerKansellertOrdre(windowDays);

  const warn = [past.warning_nb, recent.warning_nb, windowRes.ok === false ? windowRes.message : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Bestillingsprofil</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Enkel oppsummering fra den operative ordretabellen (samme kilde som «Mine lunsjendringer» og «Tidligere lunsjdager»).
        Ingen analyse eller anbefaling — kun registrerte rader i det begrensede vinduet systemet allerede henter.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs text-neutral-600">
        Tidligere dager uten ordrelinje teller ikke med. «Dager uten registrering» i kalender kan ikke utledes her uten vindusdata
        — bruk «Mine registrerte dager» eller «Min dag» for synlig bestillingsvindu.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Ukeplan
        </Link>
        <Link href="/week/min-dag" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Min dag
        </Link>
        <Link href="/week/mine-registrerte-dager" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Mine registrerte dager
        </Link>
        <Link href="/week/mine-lunsjendringer" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Mine lunsjendringer
        </Link>
        <Link href="/week/tidligere-lunsjdager" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Tidligere lunsjdager
        </Link>
        <Link href="/orders" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Bestillinger
        </Link>
      </div>

      {warn ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {warn}
        </div>
      ) : null}

      {windowRes.ok === true ? (
        <section className="mx-auto mt-8 max-w-md rounded-2xl bg-white/90 p-4 text-left ring-1 ring-black/5 sm:max-w-2xl">
          <h2 className="text-center text-sm font-semibold text-neutral-900">Synlig vindu (i dag + kommende)</h2>
          <p className="mt-2 text-center text-xs text-neutral-600">
            Fra GET /api/order/window (samme som «Min dag»). «Uten aktiv eller kansellert ordre» betyr: ikke wantsLunch og
            orderStatus er verken ACTIVE eller CANCELLED i vindussvaret.
          </p>
          <dl className="mt-4 space-y-2 text-sm text-neutral-800">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <dt className="text-neutral-600">Synlige dager uten aktiv eller kansellert ordre</dt>
              <dd className="font-medium text-neutral-900">{vinduUtenAktivEllerKansellert}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <dt className="text-neutral-600">Antall synlige dager i vinduet</dt>
              <dd className="font-medium text-neutral-900">{windowDays.length}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="mx-auto mt-8 max-w-md rounded-2xl bg-white/90 p-4 text-left ring-1 ring-black/5 sm:max-w-2xl">
        <h2 className="text-center text-sm font-semibold text-neutral-900">Oppsummering (tidligere med ordrelinje)</h2>
        <p className="mt-2 text-center text-xs text-neutral-600">
          Basert på leveringsdatoer før i dag, inntil grensen i «Tidligere lunsjdager». Per dato brukes siste oppdaterte rad.
        </p>
        <dl className="mt-4 space-y-2 text-sm text-neutral-800">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Tidligere dager med ordrelinje</dt>
            <dd className="font-medium text-neutral-900">{pastSum.antallTidligereDagerMedOrdrelinje}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Registrerte dager (aktiv ordre sist)</dt>
            <dd className="font-medium text-neutral-900">{pastSum.antallRegistrerteDager}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Kansellerte dager (avbestilt sist)</dt>
            <dd className="font-medium text-neutral-900">{pastSum.antallKansellerteDager}</dd>
          </div>
          {pastSum.antallAndreStatusDager > 0 ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <dt className="text-neutral-600">Andre statuser (sist på dagen)</dt>
              <dd className="font-medium text-neutral-900">{pastSum.antallAndreStatusDager}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Siste registrerte leveringsdato</dt>
            <dd className="font-medium text-neutral-900">
              {pastSum.sisteRegistrerteLeveringsdato
                ? `${formatDateNO(pastSum.sisteRegistrerteLeveringsdato)} · ${formatWeekdayNO(pastSum.sisteRegistrerteLeveringsdato)}`
                : "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Siste kansellerte leveringsdato</dt>
            <dd className="font-medium text-neutral-900">
              {pastSum.sisteKansellerteLeveringsdato
                ? `${formatDateNO(pastSum.sisteKansellerteLeveringsdato)} · ${formatWeekdayNO(pastSum.sisteKansellerteLeveringsdato)}`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mx-auto mt-8 max-w-md rounded-2xl bg-white/90 p-4 text-left ring-1 ring-black/5 sm:max-w-2xl">
        <h2 className="text-center text-sm font-semibold text-neutral-900">Sist endret i ordre (alle datoer)</h2>
        <p className="mt-2 text-center text-xs text-neutral-600">Fra siste rader i «Mine lunsjendringer» (sortert etter sist oppdatert).</p>
        {sistOpp.delivery_date_iso && sistOpp.sort_at ? (
          <div className="mt-4 space-y-2 text-sm text-neutral-800">
            <p>
              <span className="text-neutral-600">Leveringsdato: </span>
              <span className="font-medium text-neutral-900">
                {formatDateNO(sistOpp.delivery_date_iso)} · {formatWeekdayNO(sistOpp.delivery_date_iso)}
              </span>
            </p>
            <p>
              <span className="text-neutral-600">Sist oppdatert: </span>
              <span className="font-mono text-xs">
                {formatDateNO(sistOpp.sort_at.slice(0, 10))} kl. {formatTimeNO(sistOpp.sort_at)}
              </span>
            </p>
            <div className="text-center sm:text-left">
              <Link
                href={`/week/ordre/${encodeURIComponent(sistOpp.delivery_date_iso)}`}
                className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
              >
                Ordredetalj
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-neutral-700">Ingen ordrehistorikk å vise.</p>
        )}
      </section>

      <section className="mx-auto mt-8 w-full max-w-md sm:max-w-2xl">
        <h2 className="text-center text-sm font-semibold text-neutral-900">Nylige ordrehendelser</h2>
        <p className="mt-1 text-center text-xs text-neutral-600">De {NYLIGE_RADER_MAKS} siste radene etter sist oppdatert (samme liste som «Mine lunsjendringer»).</p>
        {nylige.length === 0 && !recent.warning_nb ? (
          <p className="mt-4 text-center text-sm text-neutral-700">Ingen nylige rader.</p>
        ) : null}
        {nylige.length > 0 ? (
          <ul className="mt-4 space-y-3 text-left">
            {nylige.map((it) => (
              <li key={it.order_id} className="rounded-2xl bg-white/90 p-3 ring-1 ring-black/5">
                <div className="text-sm font-semibold text-neutral-900">
                  {formatDateNO(it.delivery_date_iso)} · {formatWeekdayNO(it.delivery_date_iso)}
                </div>
                <div className="mt-1 text-sm text-neutral-800">{it.title_nb}</div>
                {it.slot_label_nb ? (
                  <div className="mt-1 text-xs text-neutral-600">
                    Vindu: <span className="font-mono">{it.slot_label_nb}</span>
                  </div>
                ) : null}
                <div className="mt-2">
                  <Link
                    href={`/week/ordre/${encodeURIComponent(it.delivery_date_iso)}`}
                    className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
                  >
                    Ordredetalj
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
