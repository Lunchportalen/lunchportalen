// app/(app)/week/ordre/[date]/page.tsx — read-only egen ordre/kvittering for én leveringsdato (operativ orders)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireActiveAgreement } from "@/lib/agreements/requireActiveAgreement";
import { readLocalDevAuthSession } from "@/lib/auth/devBypass";
import type { Role } from "@/lib/auth/role";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";
import { formatDateNO, formatTimeNO, formatWeekdayNO } from "@/lib/date/format";
import { isIsoDate } from "@/lib/date/oslo";
import {
  minDagDayBookableLabelNb,
  minDagLockExplanationNb,
  minDagOwnLunchLabelNb,
} from "@/lib/employee/minDagStatusNb";
import {
  fetchOrderWindowServerSide,
  type OrderWindowDay,
} from "@/lib/server/employee/fetchOrderWindowServerSide";
import { loadEmployeeOwnOrdersForDeliveryDate } from "@/lib/server/employee/loadEmployeeOwnLunchRecentHistory";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

type PageProps = { params: Promise<{ date: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { date: raw } = await props.params;
  const d = safeStr(raw);
  const title = isIsoDate(d) ? `Ordre ${formatDateNO(d)} – Lunchportalen` : "Ordre – Lunchportalen";
  return {
    title,
    description: "Ordrestatus og dagsforklaring fra vindu/ordre — kun visning.",
    robots: { index: false, follow: false },
  };
}

export default async function EmployeeOrdreDagPage(props: PageProps) {
  const { date: rawDate } = await props.params;
  const dateIso = safeStr(rawDate);
  if (!isIsoDate(dateIso)) {
    notFound();
  }

  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect(`/login?next=${encodeURIComponent(`/week/ordre/${dateIso}`)}`);
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect(`/login?next=${encodeURIComponent(`/week/ordre/${dateIso}`)}`);
  }

  const authUserId = safeStr(data.user.id);
  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <h1 className="lp-h1">Ordre for dag</h1>
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

  const [detail, windowRes] = await Promise.all([
    loadEmployeeOwnOrdersForDeliveryDate({
      userId: authUserId,
      companyId,
      locationId: locationId || null,
      deliveryDateIso: dateIso,
    }),
    fetchOrderWindowServerSide({ weeks: 2, ridPrefix: "ordre_dag_forklaring" }),
  ]);

  let windowDay: OrderWindowDay | null = null;
  let agreementMessage: string | null = null;
  let serverOsloDate = "";
  let todayCutoffStatus = "";
  let weekOrderingAllowed = false;

  if (windowRes.ok === true) {
    agreementMessage =
      windowRes.data.agreement?.message != null ? safeStr(windowRes.data.agreement.message) : null;
    serverOsloDate = safeStr(windowRes.data.serverOsloDate);
    todayCutoffStatus = safeStr(windowRes.data.todayCutoffStatus);
    weekOrderingAllowed = windowRes.data.weekOrderingAllowed === true;
    const rawDays = Array.isArray(windowRes.data.days) ? windowRes.data.days : [];
    for (const x of rawDays) {
      if (x && typeof x === "object" && safeStr((x as OrderWindowDay).date) === dateIso) {
        windowDay = x as OrderWindowDay;
        break;
      }
    }
  }

  const weekdayNb = formatWeekdayNO(dateIso);
  const primary = detail.items[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Ordre for dag</h1>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-neutral-900">
        {formatDateNO(dateIso)}
        {weekdayNb ? ` · ${weekdayNb}` : null}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Ordrestatus fra operativ ordretabell, og — når datoen finnes i vinduet — samme dagfelt som «Min dag» (GET
        /api/order/window). Kun visning.
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
      </div>

      {detail.warning_nb ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {detail.warning_nb}
        </div>
      ) : null}

      {windowRes.ok === false ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          Kunne ikke hente bestillingsvindu: {windowRes.message}. Ordrestatus nedenfor er uendret.
        </div>
      ) : null}

      {windowRes.ok === true && windowDay ? (
        <section className="mx-auto mt-8 max-w-md rounded-2xl bg-white/90 p-4 text-left ring-1 ring-black/5 sm:max-w-2xl">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">Dagsforklaring</h2>
          <p className="mt-2 text-center text-xs text-neutral-600">
            Modelldrevet fra vindussvaret (isLocked, isEnabled, lockReason, wantsLunch, orderStatus) — samme tekster som «Min
            dag».
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-neutral-800">
            <li>
              {minDagOwnLunchLabelNb({
                wantsLunch: Boolean(windowDay.wantsLunch),
                orderStatus: windowDay.orderStatus != null ? safeStr(windowDay.orderStatus) : null,
                isLocked: Boolean(windowDay.isLocked),
              })}
            </li>
            <li>{minDagDayBookableLabelNb(Boolean(windowDay.isEnabled), Boolean(windowDay.isLocked))}</li>
            {Boolean(windowDay.isLocked) || !Boolean(windowDay.isEnabled) ? (
              <li>
                {minDagLockExplanationNb(
                  windowDay.lockReason != null ? safeStr(windowDay.lockReason) : null,
                  agreementMessage,
                )}
              </li>
            ) : null}
            <li>Ukebestilling i vinduet: {weekOrderingAllowed ? "Tillatt" : "Ikke tillatt (firma/avtale)"}</li>
            {serverOsloDate && dateIso === serverOsloDate && todayCutoffStatus ? (
              <li>Cut-off i dag (Oslo): {todayCutoffStatus}</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {windowRes.ok === true && !windowDay ? (
        <p className="mx-auto mt-6 max-w-md text-center text-sm text-neutral-700">
          Denne datoen finnes ikke i det synlige bestillingsvinduet akkurat nå (vinduet lister bare et begrenset sett datoer).
          Under vises kun operativ ordrestatus for leveringsdatoen.
        </p>
      ) : null}

      {!detail.warning_nb && detail.items.length === 0 ? (
        <div className="mx-auto mt-8 max-w-md space-y-3 rounded-2xl bg-white/90 p-4 text-left ring-1 ring-black/5">
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">Status</div>
          <p className="text-center text-sm font-semibold text-neutral-900">Ingen ordrelinje for denne datoen</p>
          <p className="text-center text-sm text-neutral-700">
            Det finnes ingen rad i ordretabellen for deg på {formatDateNO(dateIso)}. Endringer i bestillingsvinduet (ønske
            meny, låste dager) finner du under «Min dag» og ukeplanen — dette er kun operativ ordrestatus.
          </p>
        </div>
      ) : null}

      {!detail.warning_nb && primary && detail.items.length === 1 ? (
        <div className="mx-auto mt-8 w-full max-w-md space-y-6 sm:max-w-2xl">
          <section className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
            <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">Kort status</h2>
            <p className="mt-2 text-center text-base font-semibold text-neutral-900">{primary.title_nb}</p>
            <p className="mt-2 text-center text-sm text-neutral-800">{primary.body_nb}</p>
            <p className="mt-3 text-center text-xs text-neutral-600">
              Sist oppdatert i ordre:{" "}
              <span className="font-mono">
                {formatDateNO(primary.sort_at.slice(0, 10))} kl. {formatTimeNO(primary.sort_at)}
              </span>
            </p>
          </section>
        </div>
      ) : null}

      {!detail.warning_nb && detail.items.length > 1 ? (
        <div className="mx-auto mt-8 w-full max-w-md space-y-4 sm:max-w-2xl">
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-800">
            <p className="text-center font-semibold text-neutral-900">Flere ordrelinjer samme dato</p>
            <p className="mt-1 text-center">
              Det finnes {detail.items.length} rader i ordretabellen for denne datoen (sjelden). Alle vises under med samme
              operative felter.
            </p>
          </section>
          <ul className="space-y-4">
            {detail.items.map((it) => (
              <li key={it.order_id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
                <div className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-600">Ordre</div>
                <div className="mt-1 text-center text-sm font-semibold text-neutral-900">{it.title_nb}</div>
                <p className="mt-2 text-center text-sm text-neutral-800">{it.body_nb}</p>
                <p className="mt-2 text-center text-xs text-neutral-600">
                  Sist oppdatert:{" "}
                  <span className="font-mono">
                    {formatDateNO(it.sort_at.slice(0, 10))} kl. {formatTimeNO(it.sort_at)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
