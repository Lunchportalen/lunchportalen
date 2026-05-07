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

const BASIS_MENU_TYPES = ["Salatbar", "Påsmurt", "Varmmat"] as const;
const LUXUS_MENU_TYPES = ["Salatbar", "Påsmurt", "Sushi", "Pokebowl", "Thaimat", "Varmmat"] as const;
const LUXUS_EXTRA_MENU_TYPES = ["Sushi", "Pokebowl", "Thaimat"] as const;

type SuperadminMenuCategory = (typeof LUXUS_MENU_TYPES)[number];

type SuperadminCategoryDayStatus = {
  category: SuperadminMenuCategory;
  menu: MenuContent | null;
  choices: SuperadminMenuChoice[];
};

type SuperadminDayStatus = {
  basis: SuperadminCategoryDayStatus[];
  luxusExtra: SuperadminCategoryDayStatus[];
  uncategorizedPublishedMenus: MenuContent[];
};

type SuperadminWeekTierCounts = {
  basisComplete: number;
  luxusComplete: number;
  isComplete: boolean;
  hasPublishedMenu: boolean;
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
  return raw
    .map((choice, index) => {
      const label = safeChoiceLabel(choice);
      return label ? { key: `${menu._id}-${index}-${label}`, label } : null;
    })
    .filter(Boolean)
    .slice(0, raw.length) as SuperadminMenuChoice[];
}

function normalizeCategoryText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a");
}

function matchMenuCategory(value: unknown): SuperadminMenuCategory | null {
  const text = normalizeCategoryText(value);
  if (!text) return null;
  if (/\bsushi\b/.test(text)) return "Sushi";
  if (/\bpoke\s*bowl\b|\bpokebowl\b|\bpoke\b/.test(text)) return "Pokebowl";
  if (/\bthai\b|\bthaimat\b/.test(text)) return "Thaimat";
  if (/\bpasmurt\b|\bsandwich\b/.test(text)) return "Påsmurt";
  if (/\bvarm\b|\bvarmmat\b/.test(text)) return "Varmmat";
  if (/\bsalat\b|\bsalatbar\b/.test(text)) return "Salatbar";
  return null;
}

function normalizeMenuCategory(menu: MenuContent): SuperadminMenuCategory | null {
  const row = menu as MenuContent & Record<string, unknown>;
  const directSources = [row.category, row.menuType, row.type, row.kind, row.title];
  for (const source of directSources) {
    const category = matchMenuCategory(source);
    if (category) return category;
  }

  const choiceLabels = menuChoices(menu).map((choice) => choice.label);
  for (const label of choiceLabels) {
    const category = matchMenuCategory(label);
    if (category) return category;
  }

  return null;
}

function publishedMenusForDate(menusByDate: Map<string, MenuContent[]>, date: string) {
  return (menusByDate.get(date) ?? []).filter((menu) => menu.isPublished === true);
}

function menuByCategoryForDate(menusByDate: Map<string, MenuContent[]>, date: string) {
  const menusByCategory = new Map<SuperadminMenuCategory, MenuContent>();
  const uncategorizedPublishedMenus: MenuContent[] = [];

  for (const menu of publishedMenusForDate(menusByDate, date)) {
    const category = normalizeMenuCategory(menu);
    if (!category) {
      uncategorizedPublishedMenus.push(menu);
      continue;
    }
    if (!menusByCategory.has(category)) {
      menusByCategory.set(category, menu);
    }
  }

  return { menusByCategory, uncategorizedPublishedMenus };
}

function buildCategoryStatuses(
  categories: readonly SuperadminMenuCategory[],
  menusByCategory: Map<SuperadminMenuCategory, MenuContent>,
): SuperadminCategoryDayStatus[] {
  return categories.map((category) => {
    const menu = menusByCategory.get(category) ?? null;
    return {
      category,
      menu,
      choices: menu ? menuChoices(menu) : [],
    };
  });
}

function dayCategoryStatus(date: string, menusByDate: Map<string, MenuContent[]>): SuperadminDayStatus {
  const { menusByCategory, uncategorizedPublishedMenus } = menuByCategoryForDate(menusByDate, date);

  return {
    basis: buildCategoryStatuses(BASIS_MENU_TYPES, menusByCategory),
    luxusExtra: buildCategoryStatuses(LUXUS_EXTRA_MENU_TYPES, menusByCategory),
    uncategorizedPublishedMenus,
  };
}

function hasAllCategories(
  categories: readonly SuperadminMenuCategory[],
  menusByCategory: Map<SuperadminMenuCategory, MenuContent>,
) {
  return categories.every((category) => menusByCategory.has(category));
}

function weekTierCounts(
  block: SuperadminWeekBlock,
  menusByDate: Map<string, MenuContent[]>,
): SuperadminWeekTierCounts {
  const dailyCategoryMaps = block.dates.map((date) => menuByCategoryForDate(menusByDate, date).menusByCategory);
  const basisComplete = dailyCategoryMaps.filter((menusByCategory) =>
    hasAllCategories(BASIS_MENU_TYPES, menusByCategory),
  ).length;
  const luxusComplete = dailyCategoryMaps.filter((menusByCategory) =>
    hasAllCategories(LUXUS_MENU_TYPES, menusByCategory),
  ).length;
  const hasPublishedMenu = block.dates.some((date) => publishedMenusForDate(menusByDate, date).length > 0);

  return {
    basisComplete,
    luxusComplete,
    isComplete: basisComplete === block.dates.length && luxusComplete === block.dates.length,
    hasPublishedMenu,
  };
}

function SuperadminCategoryLine({ status }: { status: SuperadminCategoryDayStatus }) {
  const isPublished = status.menu !== null;
  const title = safeStr(status.menu?.title);
  const details = [title, ...status.choices.map((choice) => choice.label)].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="min-w-0 text-sm leading-6 text-neutral-700 sm:truncate">
        <span className="font-semibold text-neutral-900">{status.category}</span>
        {details ? <span className="text-neutral-500"> - {details}</span> : null}
      </p>
      <span
        className={`inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
          isPublished
            ? "bg-emerald-50 text-emerald-950 ring-emerald-200"
            : "bg-[#fff3c8] text-amber-950 ring-amber-200/80"
        }`}
      >
        {isPublished ? "Publisert" : "Mangler"}
      </span>
    </div>
  );
}

function SuperadminCategoryGroup({
  title,
  statuses,
}: {
  title: string;
  statuses: SuperadminCategoryDayStatus[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">{title}</p>
      <div className="space-y-1">
        {statuses.map((status) => (
          <SuperadminCategoryLine key={status.category} status={status} />
        ))}
      </div>
    </div>
  );
}

function SuperadminUncategorizedMenuLine({ menus }: { menus: MenuContent[] }) {
  if (!menus.length) return null;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="min-w-0 text-sm leading-6 text-neutral-700 sm:truncate">
        Publisert meny uten kategori{menus.length > 1 ? ` (${menus.length})` : ""}
      </p>
      <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-[#fff3c8] px-2.5 py-1 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-200/80">
        Uten kategori
      </span>
    </div>
  );
}

function SuperadminDayPreview({
  date,
  menusByDate,
}: {
  date: string;
  menusByDate: Map<string, MenuContent[]>;
}) {
  const status = dayCategoryStatus(date, menusByDate);
  const weekday = capitalizeFirst(formatWeekdayNO(date));

  return (
    <li className="py-3">
      <div className="text-center sm:text-left">
        <p className="text-sm font-semibold text-neutral-950">
          {weekday} <span className="text-neutral-300">-</span> {formatDateNO(date)}
        </p>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <SuperadminCategoryGroup title="Basis" statuses={status.basis} />
        <SuperadminCategoryGroup title="Luxus ekstra" statuses={status.luxusExtra} />
      </div>
      <div className="mt-1.5">
        <SuperadminUncategorizedMenuLine menus={status.uncategorizedPublishedMenus} />
      </div>
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
  const counts = weekTierCounts(block, menusByDate);

  return (
    <section className="rounded-[2rem] bg-white/85 p-5 shadow-[0_12px_34px_rgba(24,20,16,0.045)] ring-1 ring-black/5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-neutral-950">{block.title}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {formatDateNO(block.dates[0] ?? "")} - {formatDateNO(block.dates[block.dates.length - 1] ?? "")}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            counts.isComplete
              ? "bg-emerald-50 text-emerald-950 ring-emerald-200"
              : "bg-[#f5c518]/15 text-neutral-950 ring-[#f5c518]/25"
          }`}
        >
          {counts.isComplete ? "Komplett" : "Mangler"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-neutral-800">
        <span className="rounded-full bg-neutral-50 px-3 py-1 ring-1 ring-black/5">
          Basis komplett {counts.basisComplete}/5
        </span>
        <span className="rounded-full bg-neutral-50 px-3 py-1 ring-1 ring-black/5">
          Luxus komplett {counts.luxusComplete}/5
        </span>
      </div>

      {!counts.hasPublishedMenu ? (
        <div className="mt-5 border-l-2 border-[#f5c518] pl-4">
          <p className="text-base font-semibold tracking-[-0.01em] text-neutral-950">{block.emptyTitle}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-600">
            Publiser Salatbar, Påsmurt og Varmmat for Basis. Legg til Sushi, Pokebowl og Thaimat for Luxus.
          </p>
        </div>
      ) : null}

      <ul className="mt-5 divide-y divide-black/5">
        {block.dates.map((date) => (
          <SuperadminDayPreview key={date} date={date} menusByDate={menusByDate} />
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

  const thisWeekCounts = weekTierCounts(weekBlocks[0]!, menusByDate);
  const nextWeekCounts = weekTierCounts(weekBlocks[1]!, menusByDate);
  const allComplete = thisWeekCounts.isComplete && nextWeekCounts.isComplete;

  return (
    <section className="w-full bg-[#fbf8f1] px-4 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">SUPERADMIN</p>
          <h1 className="mt-2 text-3xl font-semibold leading-[0.98] tracking-[-0.045em] text-neutral-950 md:text-5xl">
            Publisert ukesmeny
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-6 text-neutral-600 sm:text-base sm:leading-7">
            Forhåndsvisning av meny som ansatte får se etter avtale, nivå og tilgang.
          </p>
        </div>

        <div className="mx-auto mt-5 grid max-w-3xl grid-cols-1 gap-3 rounded-[1.75rem] bg-white/75 px-4 py-4 text-center shadow-[0_12px_40px_rgba(24,20,16,0.04)] ring-1 ring-black/5 backdrop-blur sm:grid-cols-3 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">Denne uken</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-neutral-950">
              Basis komplett {thisWeekCounts.basisComplete}/5
            </p>
            <p className="text-sm font-semibold leading-5 text-neutral-950">
              Luxus komplett {thisWeekCounts.luxusComplete}/5
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">Neste uke</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-neutral-950">
              Basis komplett {nextWeekCounts.basisComplete}/5
            </p>
            <p className="text-sm font-semibold leading-5 text-neutral-950">
              Luxus komplett {nextWeekCounts.luxusComplete}/5
            </p>
          </div>
          <div className="border-t border-black/5 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">Status</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-neutral-950">
              {menuDataError ? "Menydata mangler" : allComplete ? "Publisering komplett" : "Publisering mangler"}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
          <Link
            href="/superadmin"
            className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40"
          >
            G&aring; til systemadministrasjon
          </Link>
          <Link
            href="/kitchen"
            className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 ring-1 ring-black/10 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40"
          >
            Se kj&oslash;kkenoversikt
          </Link>
        </div>

        {menuDataError ? (
          <div className="mx-auto mt-5 max-w-2xl border-l-2 border-[#f5c518] bg-white/55 px-4 py-3 text-sm text-amber-950">
            Kunne ikke hente publisert meny akkurat nå. Superadmin-preview viser derfor trygge placeholders.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {weekBlocks.map((block) => (
            <SuperadminWeekPreviewCard key={block.title} block={block} menusByDate={menusByDate} />
          ))}
        </div>
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

