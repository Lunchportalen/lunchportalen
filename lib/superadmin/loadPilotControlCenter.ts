import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAgreementStatus } from "@/lib/auth/agreementStatus";
import { buildVariantTitleLookup } from "@/lib/kitchen/kitchenMealNote";
import { buildKitchenOrderItemDisplay, type VariantTitleLookup } from "@/lib/providers/kitchenOrderDisplay";
import { addDaysISO, cutoffStatusForDate, osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { getCurrentWeekDates } from "@/lib/date/week";
import {
  deriveOperationalBadge,
  derivePilotHealthFlags,
  evaluateGoldenPathChecklist,
  type GoldenPathChecklistItem,
  type OperationalBadge,
  type PilotHealthFlags,
} from "@/lib/superadmin/pilotControlChecklist";
import {
  mergePilotScope,
  pilotScopeFromEnv,
  pilotScopeFromQuery,
  type PilotControlScope,
} from "@/lib/superadmin/pilotControlConfig";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PilotControlStatusCounts = {
  mottatt: number;
  iProduksjon: number;
  klarForLevering: number;
  levert: number;
};

export type PilotLatestOrder = {
  id: string;
  companyName: string;
  locationName: string | null;
  employeeName: string;
  employeeEmail: string | null;
  displayLine: string | null;
  statusRaw: string;
  statusLabel: string;
  date: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PilotControlCenterData = {
  checkedAt: string;
  scope: PilotControlScope;
  scopeNote: string;
  operationalBadge: OperationalBadge;
  provider: {
    id: string;
    name: string;
    status: string;
    membershipCount: number | null;
  } | null;
  company: {
    id: string;
    name: string;
    status: string;
    agreementStatus: string | null;
    agreementActive: boolean;
    employeesActive: number;
    pendingInvites: number | null;
    primaryLocationName: string | null;
  } | null;
  orders: {
    today: number;
    thisWeek: number;
    statusCounts: PilotControlStatusCounts;
    latest: PilotLatestOrder | null;
    productionSummary: string;
  };
  menu: {
    upcomingDeliveryDaysExist: boolean;
    publishedMenuForNextDay: boolean;
    nextDeliveryDay: string | null;
    detail: string;
  };
  cutoff: {
    todayStatus: ReturnType<typeof cutoffStatusForDate>;
    todayLabel: string;
    providerCanProcessAfterCutoff: boolean;
    detail: string;
  };
  healthFlags: PilotHealthFlags;
  checklist: GoldenPathChecklistItem[];
  links: {
    companyAdmin: string | null;
    providerOrders: string;
    weekView: string;
  };
  emptyState: boolean;
  emptyMessage: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function statusLabelNb(raw: string): string {
  const s = raw.toUpperCase();
  if (s === "ACTIVE" || s === "LOCKED") return "Mottatt";
  if (s === "PREPARED") return "I produksjon";
  if (s === "DISPATCHED") return "Klar for levering";
  if (s === "DELIVERED") return "Levert";
  if (s === "PAUSED") return "Pauset";
  if (s === "CANCELLED") return "Avbestilt";
  return s || "Ukjent";
}

function countStatus(rawStatuses: string[]): PilotControlStatusCounts {
  const counts: PilotControlStatusCounts = { mottatt: 0, iProduksjon: 0, klarForLevering: 0, levert: 0 };
  for (const raw of rawStatuses) {
    const s = safeStr(raw).toUpperCase();
    if (s === "ACTIVE" || s === "LOCKED") counts.mottatt += 1;
    else if (s === "PREPARED") counts.iProduksjon += 1;
    else if (s === "DISPATCHED") counts.klarForLevering += 1;
    else if (s === "DELIVERED") counts.levert += 1;
  }
  return counts;
}

function cutoffLabel(status: ReturnType<typeof cutoffStatusForDate>): string {
  if (status === "TODAY_OPEN") return "Cutoff i dag: åpen (til 08:00)";
  if (status === "TODAY_LOCKED") return "Cutoff i dag: låst (etter 08:00)";
  if (status === "FUTURE_OPEN") return "Cutoff: fremtidig dag — åpen for ansatte";
  return "Cutoff: fortid — låst for ansatte";
}

/** Same display contract as KitchenOrderCard: `{qty} stk · {category · variant}`. */
export function buildPilotLatestOrderDisplayLine(input: {
  quantity: number;
  productNameSnapshot?: string | null;
  choiceKey?: string | null;
  itemKey?: string | null;
  itemTitleSnapshot?: string | null;
  variantLookup?: VariantTitleLookup;
}): string {
  const qty = input.quantity > 0 ? input.quantity : 1;
  const display = buildKitchenOrderItemDisplay({
    productNameSnapshot: input.productNameSnapshot,
    quantity: qty,
    choice: {
      choiceKey: input.choiceKey,
      itemKey: input.itemKey,
      itemTitleSnapshot: input.itemTitleSnapshot,
    },
    variantLookup: input.variantLookup,
  });
  return `${display.quantity} stk · ${display.displayLine}`;
}

async function resolveAutoPilotScope(admin: SupabaseClient): Promise<{ companyId: string | null; providerId: string | null }> {
  const { data, error } = await admin
    .from("orders")
    .select("company_id, provider_id, created_at")
    .not("provider_id", "is", null)
    .not("company_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { companyId: null, providerId: null };
  return {
    companyId: safeStr((data as { company_id?: string }).company_id) || null,
    providerId: safeStr((data as { provider_id?: string }).provider_id) || null,
  };
}

async function loadLatestOrderDisplay(
  admin: SupabaseClient,
  orderRow: Record<string, unknown>,
  companyName: string,
): Promise<PilotLatestOrder | null> {
  const id = safeStr(orderRow.id);
  if (!id) return null;

  const userId = safeStr(orderRow.user_id);
  const companyId = safeStr(orderRow.company_id);
  const locationId = safeStr(orderRow.location_id);
  const date = safeStr(orderRow.date);
  const statusRaw = safeStr(orderRow.status).toUpperCase();

  const [profileRes, locationRes, itemsRes, choiceRes] = await Promise.all([
    userId
      ? admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    locationId
      ? admin.from("company_locations").select("name").eq("id", locationId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("order_items")
      .select("quantity, product_name_snapshot")
      .eq("order_id", id)
      .limit(5),
    userId && date
      ? (() => {
          let q = admin
            .from("day_choices")
            .select("choice_key, item_key, item_title_snapshot")
            .eq("user_id", userId)
            .eq("company_id", companyId)
            .eq("date", date);
          if (locationId) q = q.eq("location_id", locationId);
          return q.maybeSingle();
        })()
      : Promise.resolve({ data: null }),
  ]);

  let variantLookup: VariantTitleLookup = new Map();
  try {
    variantLookup = await buildVariantTitleLookup();
  } catch {
    /* CMS variant lookup optional — snapshot/item_key may still resolve */
  }

  const profile = profileRes.data as { full_name?: string | null; email?: string | null } | null;
  const location = locationRes.data as { name?: string | null } | null;
  const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
  const choice = choiceRes.data as {
    choice_key?: string | null;
    item_key?: string | null;
    item_title_snapshot?: string | null;
  } | null;

  const firstItem = items[0] as { quantity?: number; product_name_snapshot?: string | null } | undefined;
  const displayLine = buildPilotLatestOrderDisplayLine({
    quantity: Number(firstItem?.quantity ?? 1),
    productNameSnapshot: firstItem?.product_name_snapshot ?? null,
    choiceKey: choice?.choice_key ?? null,
    itemKey: choice?.item_key ?? null,
    itemTitleSnapshot: choice?.item_title_snapshot ?? null,
    variantLookup,
  });

  const employeeName =
    safeStr(profile?.full_name) ||
    (safeStr(profile?.email) ? safeStr(profile?.email).split("@")[0] : "") ||
    "Ukjent";

  return {
    id,
    companyName,
    locationName: safeStr(location?.name) || null,
    employeeName,
    employeeEmail: safeStr(profile?.email) || null,
    displayLine,
    statusRaw,
    statusLabel: statusLabelNb(statusRaw),
    date,
    createdAt: safeStr(orderRow.created_at) || null,
    updatedAt: safeStr(orderRow.updated_at) || null,
  };
}

function emptyPayload(partial: Partial<PilotControlCenterData> & Pick<PilotControlCenterData, "scope">): PilotControlCenterData {
  const checklist = partial.checklist ?? evaluateGoldenPathChecklist({
    companyActive: false,
    agreementActive: false,
    employeesActive: 0,
    menuPublishedForUpcoming: false,
    ordersThisWeek: 0,
    latestOrderStatus: null,
    latestOrderHasDisplayLine: false,
    providerMatchesScope: false,
  });

  return {
    checkedAt: osloNowISO(),
    scopeNote: partial.scopeNote ?? "Ingen pilot-scope konfigurert.",
    operationalBadge: partial.operationalBadge ?? deriveOperationalBadge(checklist),
    provider: null,
    company: null,
    orders: partial.orders ?? {
      today: 0,
      thisWeek: 0,
      statusCounts: { mottatt: 0, iProduksjon: 0, klarForLevering: 0, levert: 0 },
      latest: null,
      productionSummary: "Ingen ordre",
    },
    menu: partial.menu ?? {
      upcomingDeliveryDaysExist: false,
      publishedMenuForNextDay: false,
      nextDeliveryDay: null,
      detail: "Menystatus ukjent.",
    },
    cutoff: partial.cutoff ?? {
      todayStatus: cutoffStatusForDate(osloTodayISODate()),
      todayLabel: cutoffLabel(cutoffStatusForDate(osloTodayISODate())),
      providerCanProcessAfterCutoff: true,
      detail: "Leverandør kan fortsette produksjon etter cutoff — kun informasjon.",
    },
    healthFlags: partial.healthFlags ?? derivePilotHealthFlags(checklist, {
      companyActive: false,
      agreementActive: false,
      employeesActive: 0,
      menuPublishedForUpcoming: false,
      ordersThisWeek: 0,
      latestOrderStatus: null,
      latestOrderHasDisplayLine: false,
      providerMatchesScope: false,
    }),
    checklist,
    links: partial.links ?? {
      companyAdmin: null,
      providerOrders: "/leverandor/ordrer",
      weekView: "/week",
    },
    emptyState: partial.emptyState ?? true,
    emptyMessage: partial.emptyMessage ?? "Ingen pilot-data tilgjengelig.",
    ...partial,
  };
}

export async function loadPilotControlCenter(searchParams?: {
  companyId?: string;
  providerId?: string;
}): Promise<PilotControlCenterData> {
  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    const scope = mergePilotScope(pilotScopeFromQuery(searchParams), pilotScopeFromEnv(), {
      companyId: null,
      providerId: null,
    });
    return emptyPayload({
      scope,
      emptyMessage: "Service role ikke tilgjengelig — kan ikke lese pilotstatus.",
    });
  }

  const auto = await resolveAutoPilotScope(admin);
  const scope = mergePilotScope(pilotScopeFromQuery(searchParams), pilotScopeFromEnv(), auto);

  if (!scope.companyId || !scope.providerId) {
    return emptyPayload({
      scope,
      scopeNote:
        "Sett PILOT_CONTROL_COMPANY_ID og PILOT_CONTROL_PROVIDER_ID, eller vent til første ordre finnes for auto-scope.",
      emptyMessage: "Pilot-scope ikke funnet. Konfigurer miljøvariabler eller opprett første ordre.",
    });
  }

  const today = osloTodayISODate();
  const weekDates = getCurrentWeekDates(new Date(`${today}T12:00:00`));
  const weekFrom = weekDates[0] ?? today;
  const weekToExclusive = addDaysISO(weekDates[weekDates.length - 1] ?? today, 1);

  const [providerRes, companyRes, agreement, employeesRes, invitesRes, locationRes, ordersWeekRes, ordersTodayRes, menuRes] =
    await Promise.all([
      admin.from("providers").select("id, name, status").eq("id", scope.providerId).maybeSingle(),
      admin.from("companies").select("id, name, status").eq("id", scope.companyId).maybeSingle(),
      getAgreementStatus(admin, scope.companyId),
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", scope.companyId)
        .eq("role", "employee")
        .is("disabled_at", null),
      admin
        .from("employee_invites")
        .select("id", { count: "exact", head: true })
        .eq("company_id", scope.companyId)
        .is("accepted_at", null),
      admin
        .from("company_locations")
        .select("id, name")
        .eq("company_id", scope.companyId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("orders")
        .select("id, date, status, provider_id, company_id, location_id, user_id, created_at, updated_at")
        .eq("provider_id", scope.providerId)
        .eq("company_id", scope.companyId)
        .gte("date", weekFrom)
        .lt("date", weekToExclusive)
        .order("created_at", { ascending: false }),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", scope.providerId)
        .eq("company_id", scope.companyId)
        .eq("date", today),
      admin
        .from("menu_service_days")
        .select("service_date, state")
        .eq("company_id", scope.companyId)
        .eq("provider_id", scope.providerId)
        .gte("service_date", today)
        .lte("service_date", addDaysISO(today, 14))
        .eq("state", "published")
        .order("service_date", { ascending: true })
        .limit(10),
    ]);

  let membershipCount: number | null = null;
  try {
    const { count } = await admin
      .from("provider_memberships")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", scope.providerId);
    membershipCount = typeof count === "number" ? count : null;
  } catch {
    membershipCount = null;
  }

  const providerRow = providerRes.data as { id?: string; name?: string; status?: string } | null;
  const companyRow = companyRes.data as { id?: string; name?: string; status?: string } | null;

  if (!providerRow?.id || !companyRow?.id) {
    return emptyPayload({
      scope,
      scopeNote: "Pilot-scope peker på ukjent firma eller leverandør.",
      emptyMessage: "Fant ikke firma eller leverandør for valgt pilot-scope.",
    });
  }

  const companyStatus = safeStr(companyRow.status).toLowerCase();
  const companyActive = companyStatus === "active";
  const employeesActive = Number(employeesRes.count ?? 0);
  const pendingInvites = typeof invitesRes.count === "number" ? invitesRes.count : null;

  const weekOrders = Array.isArray(ordersWeekRes.data) ? ordersWeekRes.data : [];
  const statusCounts = countStatus(weekOrders.map((r) => safeStr((r as { status?: string }).status)));
  const latestRow = weekOrders[0] as Record<string, unknown> | undefined;
  const latest = latestRow ? await loadLatestOrderDisplay(admin, latestRow, safeStr(companyRow.name) || "Firma") : null;

  const productionStatuses = weekOrders.map((r) => safeStr((r as { status?: string }).status).toUpperCase());
  const productionSummary =
    statusCounts.levert > 0
      ? `${statusCounts.levert} levert`
      : statusCounts.klarForLevering > 0
        ? `${statusCounts.klarForLevering} klar for levering`
        : statusCounts.iProduksjon > 0
          ? `${statusCounts.iProduksjon} i produksjon`
          : statusCounts.mottatt > 0
            ? `${statusCounts.mottatt} mottatt`
            : "Ingen aktiv produksjon";

  const menuRows = Array.isArray(menuRes.data) ? menuRes.data : [];
  const nextMenuDay = menuRows[0] as { service_date?: string } | undefined;
  const nextDeliveryDay = nextMenuDay ? safeStr(nextMenuDay.service_date) : null;
  const publishedMenuForNextDay = Boolean(nextDeliveryDay);
  const upcomingDeliveryDaysExist = weekDates.some((d) => d >= today);

  const cutoffToday = cutoffStatusForDate(today);
  const checklistInput = {
    companyActive,
    agreementActive: agreement.isActive,
    employeesActive,
    menuPublishedForUpcoming: publishedMenuForNextDay,
    ordersThisWeek: weekOrders.length,
    latestOrderStatus: latest?.statusRaw ?? null,
    latestOrderHasDisplayLine: Boolean(latest?.displayLine),
    providerMatchesScope: weekOrders.every((r) => safeStr((r as { provider_id?: string }).provider_id) === scope.providerId),
  };
  const checklist = evaluateGoldenPathChecklist(checklistInput);
  const healthFlags = derivePilotHealthFlags(checklist, checklistInput);
  const operationalBadge = deriveOperationalBadge(checklist);

  const scopeSourceLabel =
    scope.source === "env"
      ? "Miljøvariabler"
      : scope.source === "query"
        ? "URL-parameter"
        : scope.source === "auto"
          ? "Auto (siste ordre)"
          : "Ukjent";

  return {
    checkedAt: osloNowISO(),
    scope,
    scopeNote: `Operativt fokus (${scopeSourceLabel}). Read-only observasjon — ingen endring av Golden Path.`,
    operationalBadge,
    provider: {
      id: safeStr(providerRow.id),
      name: safeStr(providerRow.name) || "Leverandør",
      status: safeStr(providerRow.status) || "ukjent",
      membershipCount,
    },
    company: {
      id: safeStr(companyRow.id),
      name: safeStr(companyRow.name) || "Firma",
      status: companyStatus || "ukjent",
      agreementStatus: agreement.status,
      agreementActive: agreement.isActive,
      employeesActive,
      pendingInvites,
      primaryLocationName: safeStr((locationRes.data as { name?: string } | null)?.name) || null,
    },
    orders: {
      today: Number(ordersTodayRes.count ?? 0),
      thisWeek: weekOrders.length,
      statusCounts,
      latest,
      productionSummary,
    },
    menu: {
      upcomingDeliveryDaysExist,
      publishedMenuForNextDay,
      nextDeliveryDay,
      detail: publishedMenuForNextDay
        ? `Publisert meny funnet for ${nextDeliveryDay}.`
        : upcomingDeliveryDaysExist
          ? "Leveringsdager finnes, men ingen publisert meny er observert ennå."
          : "Ingen kommende leveringsdager i ukesvinduet.",
    },
    cutoff: {
      todayStatus: cutoffToday,
      todayLabel: cutoffLabel(cutoffToday),
      providerCanProcessAfterCutoff: true,
      detail:
        "Ansatte kan ikke endre ordre etter cutoff. Leverandør kan fortsette produksjonsstatus etter cutoff — kun informasjon.",
    },
    healthFlags,
    checklist,
    links: {
      companyAdmin: `/superadmin/companies/${scope.companyId}`,
      providerOrders: "/leverandor/ordrer",
      weekView: "/week",
    },
    emptyState: false,
    emptyMessage: null,
  };
}

/** Test helper: assert loader source contains no mutation keywords. */
export const PILOT_CONTROL_LOADER_READ_ONLY = true;
