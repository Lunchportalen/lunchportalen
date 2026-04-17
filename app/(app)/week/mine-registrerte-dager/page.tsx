// app/(app)/week/mine-registrerte-dager/page.tsx — read-only kompakt ukeoppsummering (vindu + nylige ordredager)
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
import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import {
  minDagDayBookableLabelNb,
  minDagLockExplanationNb,
  minDagOwnLunchLabelNb,
} from "@/lib/employee/minDagStatusNb";
import { partitionWindowDaysForSummary, type WindowDayLike } from "@/lib/employee/mineRegistrerteDagerPartition";
import { fetchOrderWindowServerSide, type OrderWindowData } from "@/lib/server/employee/fetchOrderWindowServerSide";
import { loadEmployeePastLunchDayHistory } from "@/lib/server/employee/loadEmployeeOwnLunchRecentHistory";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Mine registrerte dager – Lunchportalen",
  description: "Kompakt oversikt over synlig vindu og nylige ordredager. Kun visning.",
  robots: { index: false, follow: false },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

const NYLIGE_TIDLIGERE_MAKS = 14;

function WindowDayCompactCard({
  d,
  agreementMessage,
  todayIso,
  emphasisToday,
}: {
  d: WindowDayLike;
  agreementMessage: string | null;
  todayIso: string;
  emphasisToday: boolean;
}) {
  const date = safeStr(d.date);
  if (!date) return null;
  const isToday = todayIso && date === todayIso;
  const isLocked = Boolean(d.isLocked);
  const isEnabled = Boolean(d.isEnabled);
  const lockReason = d.lockReason != null ? safeStr(d.lockReason) : null;
  const wantsLunch = Boolean(d.wantsLunch);
  const orderStatus = d.orderStatus != null ? safeStr(d.orderStatus) : null;
  const lastSaved = d.lastSavedAt != null ? safeStr(d.lastSavedAt) : null;
  const wk = d.weekday != null ? safeStr(d.weekday) : "";
  const weekdayNb = formatWeekdayNO(date) || wk;

  return (
    <li
      className={`rounded-2xl p-4 ring-1 ring-black/5 ${emphasisToday && isToday ? "bg-[rgb(var(--lp-surface))]" : "bg-white/90"}`}
    >
      <div className="text-center sm:text-left">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {isToday ? "I dag" : "Synlig dag"}
        </div>
        <div className="mt-1 text-base font-semibold text-neutral-900">
          {formatDateNO(date)} · {weekdayNb}
        </div>
        <p className="mt-2 text-sm text-neutral-800">
          {minDagOwnLunchLabelNb({ wantsLunch, orderStatus, isLocked })} · {minDagDayBookableLabelNb(isEnabled, isLocked)}
        </p>
        {isLocked || !isEnabled ? (
          <p className="mt-1 text-sm text-neutral-700">{minDagLockExplanationNb(lockReason, agreementMessage)}</p>
        ) : null}
        {lastSaved ? (
          <p className="mt-1 text-xs text-neutral-600">
            Sist oppdatert i vinduet: <span className="font-mono">{lastSaved}</span>
          </p>
        ) : null}
        <div className="mt-3 text-center sm:text-left">
          <Link
            href={`/week/ordre/${encodeURIComponent(date)}`}
            className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
          >
            Ordredetalj
          </Link>
        </div>
      </div>
    </li>
  );
}

function renderWindowSection(
  title: string,
  days: WindowDayLike[],
  data: OrderWindowData,
  todayIso: string,
  emphasisToday: boolean,
) {
  const agreementMessage = data.agreement?.message != null ? safeStr(data.agreement.message) : null;
  if (days.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-center text-sm font-semibold text-neutral-900">{title}</h2>
      <ul className="space-y-3">
        {days.map((d) => {
          const date = safeStr(d.date);
          if (!date) return null;
          return <WindowDayCompactCard key={date} d={d} agreementMessage={agreementMessage} todayIso={todayIso} emphasisToday={emphasisToday} />;
        })}
      </ul>
    </section>
  );
}

export default async function EmployeeMineRegistrerteDagerPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week/mine-registrerte-dager");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?next=/week/mine-registrerte-dager");
  }

  const authUserId = safeStr(data.user.id);
  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <h1 className="lp-h1">Mine registrerte dager</h1>
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

  const [windowRes, pastHist] = await Promise.all([
    fetchOrderWindowServerSide({ weeks: 2, ridPrefix: "mine_reg_dager" }),
    loadEmployeePastLunchDayHistory({
      userId: authUserId,
      companyId,
      locationId: locationId || null,
    }),
  ]);

  const rawTodayFromWindow = windowRes.ok === true ? safeStr(windowRes.data.serverOsloDate) : "";
  const todayIso = isIsoDate(rawTodayFromWindow) ? rawTodayFromWindow : osloTodayISODate();
  const rawDays =
    windowRes.ok === true && Array.isArray(windowRes.data.days) ? windowRes.data.days : [];
  const days = rawDays.map((x) => (x && typeof x === "object" ? (x as WindowDayLike) : null)).filter(Boolean) as WindowDayLike[];

  const { today: todayDays, upcoming: upcomingDays } = partitionWindowDaysForSummary(days, todayIso);

  const nyligeTidligere = pastHist.items.slice(0, NYLIGE_TIDLIGERE_MAKS);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Mine registrerte dager</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Kompakt oversikt: synlig bestillingsvindu (samme kilde som «Min dag») og de nyeste tidligere dagene med ordrelinje i
        operativ tabell (samme kilde som «Tidligere lunsjdager»). Kun visning.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs text-neutral-600">
        Tidligere hverdager uten ordrelinje listes ikke her — de finnes ikke som rad i ordretabellen. Bruk «Tidligere
        lunsjdager» for full historikk over egne ordredager.
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
        <Link href="/week/bestillingsprofil" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Bestillingsprofil
        </Link>
        <Link href="/orders" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Bestillinger
        </Link>
      </div>

      {windowRes.ok === false ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {windowRes.message}
        </div>
      ) : null}

      {pastHist.warning_nb ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {pastHist.warning_nb}
        </div>
      ) : null}

      {windowRes.ok === true ? (
        <div className="mx-auto mt-8 w-full max-w-md space-y-8 text-left sm:max-w-2xl">
          {renderWindowSection("I dag", todayDays, windowRes.data, todayIso, true)}
          {renderWindowSection("Kommende synlige dager", upcomingDays, windowRes.data, todayIso, true)}
          {todayDays.length === 0 && upcomingDays.length === 0 && days.length === 0 ? (
            <p className="text-center text-sm text-neutral-700">Ingen synlige dager i vinduet akkurat nå.</p>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto mt-10 w-full max-w-md space-y-4 text-left sm:max-w-2xl">
        <h2 className="text-center text-sm font-semibold text-neutral-900">Nylige tidligere dager med ordrelinje</h2>
        {nyligeTidligere.length === 0 && !pastHist.warning_nb ? (
          <p className="text-center text-sm text-neutral-700">Ingen tidligere ordrelinjer i den siste perioden.</p>
        ) : null}
        {nyligeTidligere.length > 0 ? (
          <ul className="space-y-3">
            {nyligeTidligere.map((it) => {
              const wk = formatWeekdayNO(it.delivery_date_iso);
              return (
                <li key={it.order_id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
                  <div className="text-center sm:text-left">
                    <div className="text-base font-semibold text-neutral-900">
                      {formatDateNO(it.delivery_date_iso)}
                      {wk ? ` · ${wk}` : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{it.title_nb}</p>
                    {it.slot_label_nb ? (
                      <p className="mt-1 text-xs text-neutral-600">
                        Vindu: <span className="font-mono">{it.slot_label_nb}</span>
                      </p>
                    ) : null}
                    <div className="mt-3 text-center sm:text-left">
                      <Link
                        href={`/week/ordre/${encodeURIComponent(it.delivery_date_iso)}`}
                        className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
                      >
                        Ordredetalj
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
