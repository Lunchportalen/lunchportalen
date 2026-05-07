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
import { getMenuForDates, type MenuContent } from "@/lib/cms/menuContent";
import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";
import { weekRangeISO } from "@/lib/date/week";
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

type SuperadminMenuChoice = {
  key: string;
  label: string;
};

type SuperadminWeekBlock = {
  title: "Denne uken" | "Neste uke";
  emptyTitle: string;
  dates: string[];
};

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function tierPreviewLabel(menu: MenuContent) {
  const tier = String(menu.tier ?? "").trim().toUpperCase();
  if (tier === "BASIS") return "Basis - 3 valg";
  if (tier === "LUXUS" || tier === "PREMIUM") return "Luxus - 6 valg";
  return "Publisert meny";
}

function tierChoiceLimit(menu: MenuContent) {
  const tier = String(menu.tier ?? "").trim().toUpperCase();
  if (tier === "BASIS") return 3;
  if (tier === "LUXUS" || tier === "PREMIUM") return 6;
  return 0;
}

function safeChoiceLabel(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (!raw || typeof raw !== "object") return "";
  const row = raw as Record<string, unknown>;
  return String(row.label ?? row.title ?? row.name ?? row.key ?? "").trim();
}

function menuChoices(menu: MenuContent): SuperadminMenuChoice[] {
  const row = menu as MenuContent & Record<string, unknown>;
  const raw =
    (Array.isArray(row.choices) && row.choices) ||
    (Array.isArray(row.dishes) && row.dishes) ||
    (Array.isArray(row.options) && row.options) ||
    (Array.isArray(row.items) && row.items) ||
    (Array.isArray(row.meals) && row.meals) ||
    [];
  const limit = tierChoiceLimit(menu);
  return raw
    .map((choice, index) => {
      const label = safeChoiceLabel(choice);
      return label ? { key: `${menu._id}-${index}-${label}`, label } : null;
    })
    .filter(Boolean)
    .slice(0, limit || raw.length) as SuperadminMenuChoice[];
}

function hasPublishedMenusForDate(menusByDate: Map<string, MenuContent[]>, date: string) {
  return (menusByDate.get(date) ?? []).some((menu) => menu.isPublished === true);
}

function SuperadminDayPreview({ date, menus }: { date: string; menus: MenuContent[] }) {
  const publishedMenus = menus.filter((menu) => menu.isPublished === true);
  const isPublished = publishedMenus.length > 0;
  const weekday = capitalizeFirst(formatWeekdayNO(date));

  return (
    <li className="rounded-[1.35rem] bg-white/85 px-4 py-4 ring-1 ring-black/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-neutral-950">
            {weekday} <span className="text-neutral-400">·</span> {formatDateNO(date)}
          </p>
        </div>
        <span
          className={`mx-auto inline-flex min-h-[32px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 sm:mx-0 ${
            isPublished
              ? "bg-emerald-50 text-emerald-950 ring-emerald-200"
              : "bg-[#fff3c8] text-amber-950 ring-amber-200"
          }`}
        >
          {isPublished ? "Publisert" : "Ikke publisert"}
        </span>
      </div>

      {isPublished ? (
        <div className="mt-4 space-y-3">
          {publishedMenus.map((menu) => {
            const choices = menuChoices(menu);
            return (
              <article key={menu._id} className="rounded-2xl bg-[#fffaf0] px-4 py-4 ring-1 ring-amber-200/70">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex rounded-full bg-[#f2c94c]/25 px-3 py-1 text-xs font-semibold text-neutral-950 ring-1 ring-amber-200">
                    {tierPreviewLabel(menu)}
                  </span>
                </div>
                {menu.title?.trim() ? (
                  <h2 className="mt-3 text-center text-base font-semibold leading-snug text-neutral-950 sm:text-left">
                    {menu.title}
                  </h2>
                ) : null}
                {menu.description?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-center text-sm leading-6 text-neutral-700 sm:text-left">
                    {menu.description}
                  </p>
                ) : null}
                {choices.length ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    {choices.map((choice) => (
                      <span
                        key={choice.key}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-800 ring-1 ring-black/10"
                      >
                        {choice.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {Array.isArray(menu.allergens) && menu.allergens.length ? (
                  <p className="mt-3 text-center text-xs text-neutral-600 sm:text-left">
                    <span className="font-semibold">Allergener: </span>
                    {menu.allergens.map((item) => String(item)).join(", ")}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-[#fffaf0] px-4 py-4 text-center ring-1 ring-amber-200/70">
          <p className="text-sm font-semibold text-neutral-950">Ikke publisert</p>
          <p className="mt-1 text-sm text-neutral-600">Meny mangler for denne dagen.</p>
        </div>
      )}
    </li>
  );
}

function SuperadminWeekPreviewCard({
  block,
  menusByDate,
}: {
  block: SuperadminWeekBlock;
  menusByDate: Map<string, MenuContent[]>;
}) {
  const complete = block.dates.every((date) => hasPublishedMenusForDate(menusByDate, date));
  const hasAnyPublished = block.dates.some((date) => hasPublishedMenusForDate(menusByDate, date));

  return (
    <section className="rounded-[2rem] bg-white/90 p-4 shadow-[0_18px_60px_rgba(24,20,16,0.08)] ring-1 ring-black/10 sm:p-5">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Ukesblokk</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-neutral-950">{block.title}</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {formatDateNO(block.dates[0] ?? "")} - {formatDateNO(block.dates[block.dates.length - 1] ?? "")}
        </p>
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            complete
              ? "bg-emerald-50 text-emerald-950 ring-emerald-200"
              : "bg-[#fff3c8] text-amber-950 ring-amber-200"
          }`}
        >
          {complete ? "Publisering: komplett" : "Publisering: ikke komplett"}
        </span>
      </div>

      {!hasAnyPublished ? (
        <div className="mt-5 rounded-2xl bg-[#fff8e7] px-4 py-4 text-center ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-neutral-950">{block.emptyTitle}</p>
          <p className="mt-1 text-sm text-neutral-600">
            Publiser meny i systemadministrasjon før ansatte kan se den.
          </p>
        </div>
      ) : null}

      <ul className="mt-5 space-y-3">
        {block.dates.map((date) => (
          <SuperadminDayPreview key={date} date={date} menus={menusByDate.get(date) ?? []} />
        ))}
      </ul>
    </section>
  );
}

async function renderSuperadminWeekPreview() {
  const weekBlocks: SuperadminWeekBlock[] = [
    {
      title: "Denne uken",
      emptyTitle: "Ingen publisert meny denne uken.",
      dates: weekRangeISO(0),
    },
    {
      title: "Neste uke",
      emptyTitle: "Neste ukes meny er ikke publisert",
      dates: weekRangeISO(1),
    },
  ];

  const allDates = weekBlocks.flatMap((block) => block.dates);
  const menusByDate = new Map<string, MenuContent[]>();
  let menuDataError = false;

  try {
    const publishedMenus = await getMenuForDates(allDates);
    for (const menu of publishedMenus) {
      const key = String(menu.date ?? "").slice(0, 10);
      if (!key) continue;
      const existing = menusByDate.get(key) ?? [];
      existing.push(menu);
      menusByDate.set(key, existing);
    }
  } catch {
    menuDataError = true;
  }

  const allComplete = weekBlocks.every((block) =>
    block.dates.every((date) => hasPublishedMenusForDate(menusByDate, date)),
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="text-center">
        <WeekBrandMark />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Superadmin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950 md:text-5xl">
          Publisert ukesmeny
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-neutral-600">
          Forhåndsvisning av meny som ansatte får se etter avtale, nivå og tilgang.
        </p>
      </div>

      <div className="mx-auto mt-6 grid max-w-4xl gap-3 text-center sm:grid-cols-3">
        <div className="rounded-2xl bg-white/85 px-4 py-3 text-sm font-semibold text-neutral-950 ring-1 ring-black/10">
          Denne uken
        </div>
        <div className="rounded-2xl bg-white/85 px-4 py-3 text-sm font-semibold text-neutral-950 ring-1 ring-black/10">
          Neste uke
        </div>
        <div className="rounded-2xl bg-[#fff8e7] px-4 py-3 text-sm font-semibold text-neutral-950 ring-1 ring-amber-200">
          {menuDataError ? "Menydata kunne ikke leses" : allComplete ? "Publisering: komplett" : "Publisering: ikke komplett"}
        </div>
      </div>

      {menuDataError ? (
        <div className="mx-auto mt-5 max-w-2xl rounded-2xl bg-[#fff3c8] px-4 py-3 text-center text-sm text-amber-950 ring-1 ring-amber-200">
          Kunne ikke hente publisert meny akkurat nå. Superadmin-preview viser derfor trygge placeholders.
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {weekBlocks.map((block) => (
          <SuperadminWeekPreviewCard key={block.title} block={block} menusByDate={menusByDate} />
        ))}
      </div>

      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
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
    </section>
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
    return renderSuperadminWeekPreview();
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
