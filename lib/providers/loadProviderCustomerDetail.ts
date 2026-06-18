// lib/providers/loadProviderCustomerDetail.ts
import "server-only";

import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { isProviderSelfCustomer } from "@/lib/providers/providerCustomerScope";
import {
  buildKitchenOrderItemDisplay,
  dayChoiceKey,
  profileDisplayName,
} from "@/lib/providers/kitchenOrderDisplay";
import {
  mapProviderCustomerDetailActivity,
  type ProviderCustomerActivityItem,
} from "@/lib/providers/providerCustomerDetailActivity";
import {
  buildAllowedDayChoiceKeys,
  fetchProviderOrderEnrichment,
} from "@/lib/providers/providerOrderEnrichment";
import { buildVariantTitleLookup } from "@/lib/kitchen/kitchenMealNote";
import type { ProviderCustomerStatus } from "@/lib/providers/customerTypes";
import {
  buildProviderInvoiceSettings,
  computeBillingBasis,
  resolveCompanyOrgnr,
  sumOrderRevenueCents,
  type ProviderBillingBasis,
  type ProviderInvoiceSettings,
} from "@/lib/providers/providerCustomerBilling";
import { loadProviderCustomerCountsForCompanies } from "@/lib/providers/providerCustomerCounts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type ProviderCompanyDetail = {
  id: string;
  name: string;
  orgnr: string | null;
  status: ProviderCustomerStatus;
  providerId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  companyAddress: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  pausedAt: string | null;
  pausedReason: string | null;
  deletedAt: string | null;
  updatedAt: string | null;
};

export type ProviderCompanyStats = {
  employeesCount: number;
  activeOrdersCount: number;
  historicalOrdersCount: number;
  monthlyRevenueNok: number;
};

export type ProviderEmployeeRow = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
};

export type ProviderOrderLineRow = {
  quantity: number;
  productName: string;
  choiceLabel: string | null;
  variantTitle: string | null;
  displayLine: string;
};

export type ProviderOrderRow = {
  id: string;
  date: string;
  status: string;
  totalNok: number | null;
  employeeName: string | null;
  lines: ProviderOrderLineRow[];
};

export type ProviderAgreementRow = {
  id: string;
  status: string;
  createdAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  deliveryDays: string[];
  dayMenus: Array<{ day: string; plan: string }>;
  locationId: string | null;
  tier: string | null;
};

export type ProviderCompanyLocationRow = {
  id: string;
  name: string;
  address: string | null;
};

export type ProviderCustomerDetail = {
  company: ProviderCompanyDetail;
  stats: ProviderCompanyStats;
  invoice: ProviderInvoiceSettings;
  billingBasis: ProviderBillingBasis;
  ordersThisMonth: number;
  primaryLocationName: string | null;
  primaryLocationAddress: string | null;
  activeAgreementStatus: string | null;
  employees: ProviderEmployeeRow[];
  agreements: ProviderAgreementRow[];
  locations: ProviderCompanyLocationRow[];
  orders: ProviderOrderRow[];
  activity: ProviderCustomerActivityItem[];
};

const OPEN_ORDER_STATUSES = ["ACTIVE", "PREPARED", "DISPATCHED"] as const;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function centsToNok(cents: unknown): number {
  return safeNum(cents) / 100;
}

function deriveStatus(row: {
  deleted_at?: string | null;
  suspended_at?: string | null;
  paused_at?: string | null;
}): ProviderCustomerStatus {
  if (row.deleted_at) return "DELETED";
  if (row.suspended_at) return "SUSPENDED";
  if (row.paused_at) return "PAUSED";
  return "ACTIVE";
}

async function loadAgreementDayMenusByAgreementIds(
  agreementIds: string[],
): Promise<Map<string, Array<{ day: string; plan: string }>>> {
  const map = new Map<string, Array<{ day: string; plan: string }>>();
  if (agreementIds.length === 0) return map;
  try {
    const admin = supabaseAdmin();
    const { data, error } = await (admin as any)
      .from("agreement_delivery_days")
      .select("agreement_id,weekday,tier")
      .in("agreement_id", agreementIds);
    if (error || !Array.isArray(data)) return map;
    for (const row of data as Array<{ agreement_id?: string; weekday?: string; tier?: string }>) {
      const agreementId = safeStr(row.agreement_id);
      const day = safeStr(row.weekday).toLowerCase();
      const plan = safeStr(row.tier).toUpperCase();
      if (!agreementId || !day || !plan) continue;
      const list = map.get(agreementId) ?? [];
      list.push({ day, plan });
      map.set(agreementId, list);
    }
  } catch {
    return map;
  }
  return map;
}

async function loadScopedCompanyLocations(companyId: string): Promise<ProviderCompanyLocationRow[]> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("company_locations")
      .select("id, name, address")
      .eq("company_id", companyId)
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return data.map((l: Record<string, unknown>) => ({
      id: safeStr(l.id),
      name: safeStr(l.name),
      address: l.address != null ? safeStr(l.address) : null,
    }));
  } catch {
    return [];
  }
}

async function loadScopedEmployees(companyId: string): Promise<ProviderEmployeeRow[]> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role, disabled_at")
      .eq("company_id", companyId)
      .is("disabled_at", null)
      .order("full_name", { ascending: true })
      .limit(100);

    if (error || !Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: safeStr(row.id),
      name: profileDisplayName({
        full_name: row.full_name != null ? String(row.full_name) : null,
        email: row.email != null ? String(row.email) : null,
      }),
      email: row.email != null ? safeStr(row.email) : null,
      role: row.role != null ? safeStr(row.role) : null,
    }));
  } catch {
    return [];
  }
}

async function loadScopedActivity(companyId: string): Promise<ProviderCustomerActivityItem[]> {
  try {
    const admin = supabaseAdmin();
    const filter = `entity_id.eq.${companyId},company_id.eq.${companyId},detail->>company_id.eq.${companyId}`;
    const { data, error } = await admin
      .from("audit_events")
      .select("id, created_at, action, summary")
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !Array.isArray(data)) return [];

    return mapProviderCustomerDetailActivity(
      data.map((row: Record<string, unknown>) => ({
        id: safeStr(row.id),
        createdAt: String(row.created_at ?? ""),
        action: safeStr(row.action),
        summary: row.summary != null ? String(row.summary) : null,
      })),
    );
  } catch {
    return [];
  }
}

/**
 * Load one company in provider scope. Returns null when missing, cross-provider, or self-customer.
 */
export async function loadProviderCustomerDetail(
  providerId: string,
  companyId: string,
): Promise<ProviderCustomerDetail | null> {
  const pid = safeStr(providerId);
  const cid = safeStr(companyId);
  if (!pid || !cid) return null;

  const sb = await supabaseServer();
  const { data: row, error } = await (sb as any)
    .from("companies")
    .select(
      "id, name, orgnr, organization_number, provider_id, updated_at, deleted_at, suspended_at, suspended_reason, paused_at, paused_reason, contact_name, contact_email, contact_phone, address, billing_email, ehf_enabled, ehf_endpoint",
    )
    .eq("id", cid)
    .maybeSingle();

  if (error || !row || safeStr(row.provider_id) !== pid) return null;

  const { data: providerRow } = await sb.from("providers").select("id, name, org_number").eq("id", pid).maybeSingle();
  if (
    isProviderSelfCustomer(
      {
        id: cid,
        name: safeStr(row.name) || null,
        orgnr: (row.orgnr as string | null | undefined) ?? null,
      },
      providerRow
        ? {
            id: pid,
            name: safeStr((providerRow as { name?: string }).name) || null,
            orgNumber: (providerRow as { org_number?: string | null }).org_number ?? null,
          }
        : { id: pid, name: null, orgNumber: null },
    )
  ) {
    return null;
  }

  const company: ProviderCompanyDetail = {
    id: cid,
    name: safeStr(row.name) || "Uten navn",
    orgnr: resolveCompanyOrgnr(row.orgnr, row.organization_number),
    status: deriveStatus(row),
    providerId: pid,
    contactName: row.contact_name != null ? safeStr(row.contact_name) || null : null,
    contactEmail: row.contact_email != null ? safeStr(row.contact_email) || null : null,
    contactPhone: row.contact_phone != null ? safeStr(row.contact_phone) || null : null,
    companyAddress: row.address != null ? safeStr(row.address) || null : null,
    suspendedAt: row.suspended_at != null ? String(row.suspended_at) : null,
    suspendedReason: row.suspended_reason != null ? String(row.suspended_reason) : null,
    pausedAt: row.paused_at != null ? String(row.paused_at) : null,
    pausedReason: row.paused_reason != null ? String(row.paused_reason) : null,
    deletedAt: row.deleted_at != null ? String(row.deleted_at) : null,
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };

  const invoice = buildProviderInvoiceSettings({
    orgnr: row.orgnr,
    organizationNumber: row.organization_number,
    billingEmail: row.billing_email,
    ehfEnabled: row.ehf_enabled,
    ehfEndpoint: row.ehf_endpoint,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
  });

  const today = osloTodayISODate();
  const monthStart = addDaysISO(today, -30);
  const weekStart = startOfWeekISO(today);
  const weekEnd = addDaysISO(weekStart, 7);

  const [employees, agreementsP, locations, ordersAllP, ordersOpenP, ordersMonthP, activity, customerCounts] =
    await Promise.all([
    loadScopedEmployees(cid),
    sb
      .from("agreements")
      .select("id, status, created_at, starts_at, ends_at, delivery_days, location_id, tier")
      .eq("company_id", cid)
      .eq("provider_id", pid)
      .order("created_at", { ascending: false })
      .limit(10),
    loadScopedCompanyLocations(cid),
    sb
      .from("orders")
      .select("id, date, status, gross_cents_inc_vat, user_id, location_id, slot")
      .eq("provider_id", pid)
      .eq("company_id", cid)
      .order("date", { ascending: false })
      .limit(30),
    sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", pid)
      .eq("company_id", cid)
      .in("status", [...OPEN_ORDER_STATUSES]),
    sb
      .from("orders")
      .select("gross_cents_inc_vat, subtotal_cents_ex_vat, vat_cents")
      .eq("provider_id", pid)
      .eq("company_id", cid)
      .gte("date", monthStart)
      .lte("date", today),
    loadScopedActivity(cid),
    loadProviderCustomerCountsForCompanies(pid, [cid], weekStart, weekEnd),
  ]);

  const orderRows = Array.isArray(ordersAllP.data) ? ordersAllP.data : [];
  const scopedOrderIds = orderRows.map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);
  const userIds = [...new Set(orderRows.map((r) => safeStr((r as { user_id?: string }).user_id)).filter(Boolean))];
  const locationIds = [
    ...new Set(orderRows.map((r) => safeStr((r as { location_id?: string }).location_id)).filter(Boolean)),
  ];

  const minDate = orderRows.length
    ? orderRows.reduce((acc, r) => {
        const d = safeStr((r as { date?: string }).date);
        return !acc || (d && d < acc) ? d : acc;
      }, "")
    : today;
  const maxDate = orderRows.length
    ? orderRows.reduce((acc, r) => {
        const d = safeStr((r as { date?: string }).date);
        return !acc || (d && d > acc) ? d : acc;
      }, "")
    : today;

  const { profileById, dayChoiceMap, itemsByOrder } = await fetchProviderOrderEnrichment({
    scopedOrderIds,
    userIds,
    locationIds,
    allowedDayChoiceKeys: buildAllowedDayChoiceKeys(orderRows),
    dateFrom: minDate || today,
    dateToExclusive: addDaysISO(maxDate || today, 1),
  });

  let variantLookup = new Map<string, string>();
  try {
    variantLookup = await buildVariantTitleLookup();
  } catch {
    /* optional */
  }

  const monthOrders = Array.isArray(ordersMonthP.data) ? ordersMonthP.data : [];
  const revenueTotals = sumOrderRevenueCents(monthOrders);
  const ordersThisMonth = monthOrders.length;
  const billingBasis = computeBillingBasis({
    ordersThisMonth,
    revenueExVatNok: revenueTotals.hasExVat ? revenueTotals.revenueExVatNok : null,
    vatNok: revenueTotals.hasVat ? revenueTotals.vatNok : null,
    revenueIncVatNok: revenueTotals.revenueIncVatNok,
  });

  const scopedCounts = customerCounts.byCompanyId.get(cid);
  const stats: ProviderCompanyStats = {
    employeesCount: scopedCounts?.employeesCount ?? employees.length,
    activeOrdersCount: safeNum(ordersOpenP.count),
    historicalOrdersCount: scopedCounts?.historicalOrdersCount ?? orderRows.length,
    monthlyRevenueNok: revenueTotals.revenueIncVatNok,
  };

  const agreementRows = Array.isArray(agreementsP.data) ? agreementsP.data : [];
  const agreementIds = agreementRows.map((a) => safeStr((a as { id?: string }).id)).filter(Boolean);
  const dayMenusByAgreement = await loadAgreementDayMenusByAgreementIds(agreementIds);

  const agreements: ProviderAgreementRow[] = agreementRows.map((a: Record<string, unknown>) => {
    const id = safeStr(a.id);
    return {
      id,
      status: safeStr(a.status) || "UNKNOWN",
      createdAt: a.created_at != null ? String(a.created_at) : null,
      startsAt: a.starts_at != null ? String(a.starts_at) : null,
      endsAt: a.ends_at != null ? String(a.ends_at) : null,
      deliveryDays: Array.isArray(a.delivery_days)
        ? a.delivery_days.map((d) => safeStr(d).toLowerCase()).filter(Boolean)
        : [],
      dayMenus: dayMenusByAgreement.get(id) ?? [],
      locationId: a.location_id != null ? safeStr(a.location_id) : null,
      tier: a.tier != null ? safeStr(a.tier) : null,
    };
  });

  const orders: ProviderOrderRow[] = orderRows.map((raw) => {
    const r = raw as Record<string, unknown>;
    const id = safeStr(r.id);
    const companyId = cid;
    const locationId = r.location_id != null ? safeStr(r.location_id) : null;
    const userId = safeStr(r.user_id);
    const date = safeStr(r.date);
    const choiceKey = dayChoiceKey({ companyId, locationId, userId, date });
    const choiceCtx = dayChoiceMap.get(choiceKey)?.choice ?? null;
    const rawItems = itemsByOrder.get(id) ?? [];

    const lines: ProviderOrderLineRow[] =
      rawItems.length > 0
        ? rawItems.map((item) => {
            const display = buildKitchenOrderItemDisplay({
              productNameSnapshot: item.productNameSnapshot,
              quantity: item.quantity,
              choice: choiceCtx,
              variantLookup,
            });
            return {
              quantity: display.quantity,
              productName: display.productName,
              choiceLabel: display.choiceLabel,
              variantTitle: display.variantTitle,
              displayLine: display.displayLine,
            };
          })
        : choiceCtx
          ? [
              {
                ...buildKitchenOrderItemDisplay({
                  productNameSnapshot: null,
                  quantity: 1,
                  choice: choiceCtx,
                  variantLookup,
                }),
                displayLine: buildKitchenOrderItemDisplay({
                  productNameSnapshot: null,
                  quantity: 1,
                  choice: choiceCtx,
                  variantLookup,
                }).displayLine,
              },
            ]
          : [];

    const profile = userId ? profileById.get(userId) : null;

    return {
      id,
      date,
      status: safeStr(r.status) || "UNKNOWN",
      totalNok: r.gross_cents_inc_vat != null ? centsToNok(r.gross_cents_inc_vat) : null,
      employeeName: profile ? profileDisplayName(profile) : null,
      lines,
    };
  });

  const activeAgreement = agreements.find((a) => String(a.status).toUpperCase() === "ACTIVE") ?? agreements[0] ?? null;
  const primaryLocation =
    activeAgreement?.locationId != null
      ? locations.find((l) => l.id === activeAgreement.locationId) ?? null
      : locations[0] ?? null;

  return {
    company,
    stats,
    invoice,
    billingBasis,
    ordersThisMonth,
    primaryLocationName: primaryLocation?.name ?? null,
    primaryLocationAddress: primaryLocation?.address ?? null,
    activeAgreementStatus: activeAgreement?.status ?? null,
    employees,
    agreements,
    locations,
    orders,
    activity,
  };
}
