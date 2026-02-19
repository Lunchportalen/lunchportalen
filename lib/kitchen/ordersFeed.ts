import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

type FlatOrderRow = {
  company_id: string;
  location_id: string;
  slot: string | null;
  user_id: string;
  note: string | null;
  status: string | null;
};

export type KitchenEmployee = {
  userId: string;
  name: string;
  dept: string | null;
  note: string | null;
};

export type KitchenLocation = {
  locationId: string;
  locationName: string;
  employees: KitchenEmployee[];
};

export type KitchenCompany = {
  companyId: string;
  companyName: string;
  locations: KitchenLocation[];
};

export type KitchenSlot = {
  slot: string;
  companies: KitchenCompany[];
};

export type KitchenFeed = {
  date: string;
  slots: KitchenSlot[];
};

export type KitchenScope = {
  role: "kitchen" | "superadmin";
  companyId: string | null;
  locationId: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normStatus(v: unknown): "ORDERED" | "CANCELED" | "OTHER" {
  const up = safeStr(v).toUpperCase();
  if (up === "ORDERED" || up === "ACTIVE") return "ORDERED";
  if (up === "CANCELED" || up === "CANCELLED") return "CANCELED";
  return "OTHER";
}

function isMissingSchemaError(error: any) {
  const msg = safeStr(error?.message).toLowerCase();
  return msg.includes("does not exist") || msg.includes("not exist") || msg.includes("column");
}

function applyTenantScope(query: any, scope: KitchenScope) {
  if (scope.role !== "kitchen") return query;
  if (!scope.companyId || !scope.locationId) return query;
  return query.eq("company_id", scope.companyId).eq("location_id", scope.locationId);
}

async function fetchRowsFromDaily(date: string, scope: KitchenScope): Promise<FlatOrderRow[] | null> {
  const admin = supabaseAdmin();
  let q = admin
    .from("daily_employee_orders")
    .select("company_id,location_id,slot,user_id,note,status")
    .eq("date", date);

  q = applyTenantScope(q, scope);
  const { data, error } = await q;

  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(`DAILY_EMPLOYEE_ORDERS_FAILED:${safeStr(error.message)}`);
  }

  return (data ?? []) as FlatOrderRow[];
}

async function fetchRowsFromOrders(date: string, scope: KitchenScope): Promise<FlatOrderRow[]> {
  const admin = supabaseAdmin();
  let q = admin
    .from("orders")
    .select("company_id,location_id,slot,user_id,note,status")
    .eq("date", date);

  q = applyTenantScope(q, scope);
  const { data, error } = await q;
  if (error) {
    throw new Error(`ORDERS_FALLBACK_FAILED:${safeStr(error.message)}`);
  }
  return (data ?? []) as FlatOrderRow[];
}

async function fetchCompanyNames(companyIds: string[]) {
  const admin = supabaseAdmin();
  if (!companyIds.length) return new Map<string, string>();
  const { data } = await admin.from("companies").select("id,name").in("id", companyIds);
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    const id = safeStr((row as any).id);
    if (!id) continue;
    out.set(id, safeStr((row as any).name) || id);
  }
  return out;
}

async function fetchLocationNames(locationIds: string[]) {
  const admin = supabaseAdmin();
  if (!locationIds.length) return new Map<string, string>();
  const { data } = await admin.from("company_locations").select("id,name").in("id", locationIds);
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    const id = safeStr((row as any).id);
    if (!id) continue;
    out.set(id, safeStr((row as any).name) || id);
  }
  return out;
}

async function fetchProfileMeta(userIds: string[]) {
  const admin = supabaseAdmin();
  const out = new Map<string, { name: string; dept: string | null }>();
  if (!userIds.length) return out;

  const attempts = [
    "user_id,full_name,name,department",
    "user_id,name,department",
    "user_id,name",
    "user_id",
  ];

  let rows: any[] = [];
  for (const select of attempts) {
    const res = await admin.from("profiles").select(select).in("user_id", userIds);
    if (!res.error) {
      rows = (res.data ?? []) as any[];
      break;
    }
    if (!isMissingSchemaError(res.error)) {
      throw new Error(`PROFILES_LOOKUP_FAILED:${safeStr(res.error.message)}`);
    }
  }

  for (const row of rows) {
    const userId = safeStr(row?.user_id);
    if (!userId) continue;
    const name = safeStr(row?.full_name) || safeStr(row?.name) || userId;
    const dept = safeStr(row?.department) || null;
    out.set(userId, { name, dept });
  }

  return out;
}

function toGroupedFeed(date: string, rows: FlatOrderRow[], names: {
  companies: Map<string, string>;
  locations: Map<string, string>;
  profiles: Map<string, { name: string; dept: string | null }>;
}): KitchenFeed {
  const slotMap = new Map<string, Map<string, Map<string, KitchenEmployee[]>>>();

  for (const row of rows) {
    if (normStatus(row.status) !== "ORDERED") continue;

    const slot = safeStr(row.slot) || "default";
    const companyId = safeStr(row.company_id);
    const locationId = safeStr(row.location_id);
    const userId = safeStr(row.user_id);
    if (!companyId || !locationId || !userId) continue;

    const profile = names.profiles.get(userId);
    const employee: KitchenEmployee = {
      userId,
      name: profile?.name ?? userId,
      dept: profile?.dept ?? null,
      note: safeStr(row.note) || null,
    };

    if (!slotMap.has(slot)) slotMap.set(slot, new Map());
    const companyMap = slotMap.get(slot)!;

    if (!companyMap.has(companyId)) companyMap.set(companyId, new Map());
    const locationMap = companyMap.get(companyId)!;

    if (!locationMap.has(locationId)) locationMap.set(locationId, []);
    locationMap.get(locationId)!.push(employee);
  }

  const slots: KitchenSlot[] = Array.from(slotMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, "nb"))
    .map(([slot, companyMap]) => {
      const companies: KitchenCompany[] = Array.from(companyMap.entries())
        .sort(([a], [b]) => (names.companies.get(a) ?? a).localeCompare(names.companies.get(b) ?? b, "nb"))
        .map(([companyId, locationMap]) => {
          const locations: KitchenLocation[] = Array.from(locationMap.entries())
            .sort(([a], [b]) => (names.locations.get(a) ?? a).localeCompare(names.locations.get(b) ?? b, "nb"))
            .map(([locationId, employees]) => ({
              locationId,
              locationName: names.locations.get(locationId) ?? locationId,
              employees: [...employees].sort((a, b) => a.name.localeCompare(b.name, "nb")),
            }));

          return {
            companyId,
            companyName: names.companies.get(companyId) ?? companyId,
            locations,
          };
        });

      return { slot, companies };
    });

  return { date, slots };
}

export async function loadKitchenFeed(date: string, scope: KitchenScope): Promise<KitchenFeed> {
  const rowsDaily = await fetchRowsFromDaily(date, scope);
  const rows = rowsDaily ?? (await fetchRowsFromOrders(date, scope));

  const companyIds = Array.from(new Set(rows.map((r) => safeStr(r.company_id)).filter(Boolean)));
  const locationIds = Array.from(new Set(rows.map((r) => safeStr(r.location_id)).filter(Boolean)));
  const userIds = Array.from(new Set(rows.map((r) => safeStr(r.user_id)).filter(Boolean)));

  const [companies, locations, profiles] = await Promise.all([
    fetchCompanyNames(companyIds),
    fetchLocationNames(locationIds),
    fetchProfileMeta(userIds),
  ]);

  return toGroupedFeed(date, rows, { companies, locations, profiles });
}
