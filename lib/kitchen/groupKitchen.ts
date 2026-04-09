// STATUS: KEEP

// lib/kitchen/groupKitchen.ts
import "server-only";

export type KitchenOrderRow = {
  id: string;
  date: string;
  slot: string | null;
  status: string | null;
  note: string | null;
  created_at: string | null;

  company_id: string | null;
  location_id: string | null;

  profiles?: { id?: string | null; full_name?: string | null; department?: string | null } | null;
  companies?: { id?: string | null; name?: string | null } | null;
  company_locations?: { id?: string | null; name?: string | null } | null;
};

type Blocked = {
  reasonTitle: string;
  reasonText: string;
  code: string;
  message: string;
  detail?: any;
};

type EmployeeItem = {
  order_id: string;
  name: string;
  department: string | null;
  note: string | null;
  status: string;
};

type LocationGroup = {
  location_id: string;
  location_name: string;
  employees: EmployeeItem[];
};

type CompanyGroup = {
  company_id: string;
  company_name: string;
  locations: LocationGroup[];
};

type SlotGroup = {
  slotLabel: string;
  totalInSlot: number;
  companies: CompanyGroup[];
};

type Totals = {
  totalOrders: number;
  perSlot: Array<{ slot: string; count: number }>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normName(v: unknown) {
  const s = safeStr(v);
  return s || "Ukjent";
}

function isAllowedStatus(status: string | null | undefined) {
  return safeStr(status).toLowerCase() === "active";
}

function sortAsc(a: string, b: string) {
  return a.localeCompare(b, "nb", { sensitivity: "base" });
}

/**
 * HARD FAIL-CLOSED validator:
 * Hvis én ordre bryter reglene -> returner blocked
 */
function validateOrders(orders: KitchenOrderRow[]): Blocked | null {
  if (orders.length === 0) {
    return {
      reasonTitle: "orders.length === 0",
      reasonText: "Ingen ordre. Produksjonsview må blokkeres (fail-closed).",
      code: "NO_ORDERS",
      message: "orders.length må være > 0.",
      detail: {},
    };
  }

  for (const o of orders) {
    const slot = safeStr(o.slot);
    const companyId = safeStr(o.company_id);
    const locationId = safeStr(o.location_id);
    const status = safeStr(o.status).toLowerCase();

    if (!slot) {
      return {
        reasonTitle: "slot mangler",
        reasonText: "Minst én ordre mangler slot. Hele produksjonsview blokkeres (fail-closed).",
        code: "MISSING_SLOT",
        message: "slot må være satt på alle ordre.",
        detail: { order_id: o.id },
      };
    }

    if (!companyId) {
      return {
        reasonTitle: "company_id mangler",
        reasonText: "Minst én ordre mangler company_id. Hele produksjonsview blokkeres (fail-closed).",
        code: "MISSING_COMPANY_ID",
        message: "company_id må være satt på alle ordre.",
        detail: { order_id: o.id, slot },
      };
    }

    if (!locationId) {
      return {
        reasonTitle: "location_id mangler",
        reasonText: "Minst én ordre mangler location_id. Hele produksjonsview blokkeres (fail-closed).",
        code: "MISSING_LOCATION_ID",
        message: "location_id må være satt på alle ordre.",
        detail: { order_id: o.id, slot, company_id: companyId },
      };
    }

    if (!isAllowedStatus(status)) {
      return {
        reasonTitle: "status ikke tillatt",
        reasonText: "Minst én ordre har status som ikke er eksplisitt tillatt (active). Hele view blokkeres.",
        code: "STATUS_NOT_ALLOWED",
        message: "Kun status=active er tillatt i produksjonslisten.",
        detail: { order_id: o.id, status: o.status, slot, company_id: companyId, location_id: locationId },
      };
    }
  }

  return null;
}

export function groupKitchenProduction(orders: KitchenOrderRow[]): {
  blocked?: Blocked;
  totals?: Totals;
  slots?: SlotGroup[];
} {
  const blocked = validateOrders(orders);
  if (blocked) return { blocked };

  // Først: deterministisk sort på input (ingen tilfeldig rekkefølge)
  const sorted = [...orders].sort((a, b) => {
    const sa = safeStr(a.slot);
    const sb = safeStr(b.slot);
    const ca = safeStr(a.company_id);
    const cb = safeStr(b.company_id);
    const la = safeStr(a.location_id);
    const lb = safeStr(b.location_id);
    const na = normName(a.profiles?.full_name);
    const nb = normName(b.profiles?.full_name);

    // Slot ASC → Company ASC → Location ASC → Employee ASC
    if (sa !== sb) return sortAsc(sa, sb);
    if (ca !== cb) return sortAsc(ca, cb);
    if (la !== lb) return sortAsc(la, lb);
    if (na !== nb) return sortAsc(na, nb);

    // Stabil tie-breaker
    return sortAsc(safeStr(a.id), safeStr(b.id));
  });

  // Map: slot -> company -> location -> employees
  const slotMap = new Map<string, Map<string, Map<string, EmployeeItem[]>>>();

  // navn maps (for headers)
  const companyNames = new Map<string, string>();
  const locationNames = new Map<string, string>();

  // totals per slot
  const slotCounts = new Map<string, number>();

  for (const o of sorted) {
    const slot = safeStr(o.slot);
    const companyId = safeStr(o.company_id);
    const locationId = safeStr(o.location_id);

    const companyName = normName(o.companies?.name);
    const locationName = normName(o.company_locations?.name);

    companyNames.set(companyId, companyName);
    locationNames.set(locationId, locationName);

    const emp: EmployeeItem = {
      order_id: safeStr(o.id),
      name: normName(o.profiles?.full_name),
      department: safeStr(o.profiles?.department) || null,
      note: safeStr(o.note) || null,
      status: safeStr(o.status).toLowerCase(),
    };

    if (!slotMap.has(slot)) slotMap.set(slot, new Map());
    const coMap = slotMap.get(slot)!;

    if (!coMap.has(companyId)) coMap.set(companyId, new Map());
    const locMap = coMap.get(companyId)!;

    if (!locMap.has(locationId)) locMap.set(locationId, []);
    locMap.get(locationId)!.push(emp);

    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  }

  // Build output structure deterministisk
  const slots: SlotGroup[] = Array.from(slotMap.keys())
    .sort(sortAsc)
    .map((slotLabel) => {
      const coMap = slotMap.get(slotLabel)!;

      const companies: CompanyGroup[] = Array.from(coMap.keys())
        .sort(sortAsc)
        .map((company_id) => {
          const locMap = coMap.get(company_id)!;

          const locations: LocationGroup[] = Array.from(locMap.keys())
            .sort(sortAsc)
            .map((location_id) => {
              const employees = locMap.get(location_id)!;

              // Employee ASC (navn + fallback)
              employees.sort((a, b) => {
                if (a.name !== b.name) return sortAsc(a.name, b.name);
                return sortAsc(a.order_id, b.order_id);
              });

              return {
                location_id,
                location_name: locationNames.get(location_id) ?? "Ukjent",
                employees,
              };
            });

          return {
            company_id,
            company_name: companyNames.get(company_id) ?? "Ukjent",
            locations,
          };
        });

      return {
        slotLabel,
        totalInSlot: slotCounts.get(slotLabel) ?? 0,
        companies,
      };
    });

  const totals: Totals = {
    totalOrders: sorted.length,
    perSlot: Array.from(slotCounts.entries())
      .sort((a, b) => sortAsc(a[0], b[0]))
      .map(([slot, count]) => ({ slot, count })),
  };

  return { totals, slots };
}
