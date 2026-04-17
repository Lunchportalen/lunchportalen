// app/(app)/week/min-dag/page.tsx — read-only «min dag» / status (samme datakilde som /api/order/window)
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
import {
  minDagDayBookableLabelNb,
  minDagLockExplanationNb,
  minDagOwnLunchLabelNb,
} from "@/lib/employee/minDagStatusNb";
import {
  fetchOrderWindowServerSide,
  type OrderWindowData,
  type OrderWindowDay,
} from "@/lib/server/employee/fetchOrderWindowServerSide";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Min dag – Lunchportalen",
  description: "Les oversikt over egen lunsjstatus og synlige dager. Endring skjer i ukeplanen.",
  robots: { index: false, follow: false },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function MinDagWindowView({ data }: { data: OrderWindowData }) {
  const companyName = safeStr(data.company?.name) || "Firma";
  const agreementMessage = data.agreement?.message != null ? safeStr(data.agreement.message) : null;
  const todayIso = safeStr(data.serverOsloDate);
  const cutoffToday = safeStr(data.todayCutoffStatus);
  const weekOrderingAllowed = data.weekOrderingAllowed === true;
  const rawDays = Array.isArray(data.days) ? data.days : [];
  const days = rawDays.map((x) => (x && typeof x === "object" ? (x as OrderWindowDay) : null)).filter(Boolean) as OrderWindowDay[];

  return (
    <div className="mx-auto mt-8 w-full max-w-md space-y-6 text-left sm:max-w-2xl">
      <section className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
        <h2 className="text-center text-sm font-semibold text-neutral-900">Kontekst</h2>
        <dl className="mt-3 space-y-2 text-sm text-neutral-800">
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Firma</dt>
            <dd className="font-medium text-neutral-900">{companyName}</dd>
          </div>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">I dag (Oslo)</dt>
            <dd className="font-medium text-neutral-900">{todayIso ? formatDateNO(todayIso) : "—"}</dd>
          </div>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Cut-off i dag</dt>
            <dd className="font-mono text-xs text-neutral-800">{cutoffToday || "—"}</dd>
          </div>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
            <dt className="text-neutral-600">Ukebestilling</dt>
            <dd className="text-neutral-900">{weekOrderingAllowed ? "Tillatt i vinduet" : "Ikke tillatt (firma/avtale)"}</dd>
          </div>
          {agreementMessage ? (
            <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-800">
              <span className="font-semibold text-neutral-600">Avtale: </span>
              {agreementMessage}
            </div>
          ) : null}
        </dl>
      </section>

      {days.length === 0 ? (
        <p className="text-center text-sm text-neutral-700">Ingen synlige dager akkurat nå.</p>
      ) : (
        <ul className="space-y-4">
          {days.map((d) => {
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
                key={date}
                className={`rounded-2xl p-4 ring-1 ring-black/5 ${isToday ? "bg-[rgb(var(--lp-surface))]" : "bg-white/90"}`}
              >
                <div className="text-center sm:text-left">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    {isToday ? "I dag" : "Synlig dag"}
                  </div>
                  <div className="mt-1 text-base font-semibold text-neutral-900">
                    {formatDateNO(date)} · {weekdayNb}
                  </div>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-800">
                  <li>{minDagOwnLunchLabelNb({ wantsLunch, orderStatus, isLocked })}</li>
                  <li>{minDagDayBookableLabelNb(isEnabled, isLocked)}</li>
                  {isLocked || !isEnabled ? <li>{minDagLockExplanationNb(lockReason, agreementMessage)}</li> : null}
                  {lastSaved ? (
                    <li>
                      Sist oppdatert i vinduet: <span className="font-mono text-xs">{lastSaved}</span>
                    </li>
                  ) : null}
                </ul>
                <div className="mt-3 text-center sm:text-left">
                  <Link
                    href={`/week/ordre/${encodeURIComponent(date)}`}
                    className="text-sm font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
                  >
                    Ordre og dagsforklaring
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-xs text-neutral-600">
        For å bestille eller avbestille: bruk ukeplanen. Operativ sannhet kommer fra samme tjeneste som viser meny og låser ved cut-off.
      </p>
    </div>
  );
}

export default async function EmployeeMinDagPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week/min-dag");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?next=/week/min-dag");
  }

  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role === "superadmin") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <h1 className="lp-h1">Min dag</h1>
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

  const window = await fetchOrderWindowServerSide({ weeks: 2, ridPrefix: "min_dag" });

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Min dag</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Oversikt for ditt firma og dine bestillinger i synlig vindu. Samme operative grunnlag som ukeplanen — kun visning.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Gå til ukeplan
        </Link>
        <Link href="/orders" className="lp-btn lp-btn--secondary lp-neon-focus min-h-[44px]">
          Bestillinger
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
      </div>

      {window.ok === false ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {window.message}
        </div>
      ) : (
        <MinDagWindowView data={window.data} />
      )}
    </main>
  );
}
