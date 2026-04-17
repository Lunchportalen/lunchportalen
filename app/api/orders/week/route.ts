export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { addDaysISO, isIsoDate, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { receiptFor } from "@/lib/api/orderResponse";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireCompanyScopeOr403, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { getMenuForDates, menuContentHasDisplayableCopy } from "@/lib/cms/menuContent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type OrdersSchema = {
  hasSlot: boolean;
  checkedAt: number;
};

type WeekOrderRow = {
  id: string;
  date: string;
  status: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  slot?: string | null;
};

const SCHEMA_CACHE_MS = 5 * 60 * 1000;
const MENU_CACHE_MS = 30 * 1000;
let ordersSchemaCache: OrdersSchema | null = null;
const weekMenuCache = new Map<string, { expiresAt: number; publishedDates: string[] }>();

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isMissingColumnError(error: any, column: string) {
  const msg = safeStr(error?.message).toLowerCase();
  return msg.includes("column") && msg.includes(column.toLowerCase()) && (msg.includes("does not exist") || msg.includes("not exist"));
}

function isAnyMissingColumnError(error: any, columns: string[]) {
  return columns.some((column) => isMissingColumnError(error, column));
}

function weekMenuCacheKey(days: string[]) {
  return days.join("|");
}

async function getPublishedDatesCached(days: string[]): Promise<Set<string>> {
  const key = weekMenuCacheKey(days);
  const now = Date.now();
  const hit = weekMenuCache.get(key);
  if (hit && hit.expiresAt > now) {
    return new Set(hit.publishedDates);
  }

  const menus = await getMenuForDates(days);
  const publishedDates = (menus ?? [])
    .filter((menu: any) => menu?.isPublished === true && menuContentHasDisplayableCopy(menu))
    .map((menu: any) => safeStr(menu?.date))
    .filter(Boolean);

  weekMenuCache.set(key, {
    expiresAt: now + MENU_CACHE_MS,
    publishedDates,
  });

  if (weekMenuCache.size > 200) {
    for (const [cacheKey, cacheValue] of weekMenuCache) {
      if (cacheValue.expiresAt <= now) weekMenuCache.delete(cacheKey);
    }
  }

  return new Set(publishedDates);
}

function parseWeekToMonday(week: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(safeStr(week));
  if (!m) return null;

  const year = Number(m[1]);
  const weekNo = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(weekNo) || weekNo < 1 || weekNo > 53) return null;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4IsoDow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4IsoDow + 1 + (weekNo - 1) * 7);

  const yyyy = monday.getUTCFullYear();
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekDays(mondayISO: string) {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(mondayISO, i));
}

function mapOrderStatus(raw: string | null): "ORDERED" | "CANCELED" | null {
  const up = safeStr(raw).toUpperCase();
  if (!up) return null;
  if (up === "ACTIVE" || up === "ORDERED") return "ORDERED";
  if (up === "CANCELLED" || up === "CANCELED") return "CANCELED";
  return null;
}

async function verifyOrdersSchema(): Promise<OrdersSchema> {
  const now = Date.now();
  if (ordersSchemaCache && now - ordersSchemaCache.checkedAt < SCHEMA_CACHE_MS) {
    return ordersSchemaCache;
  }

  const admin = supabaseAdmin();
  const requiredSelect = "id,date,status,note,created_at,updated_at,user_id,company_id,location_id";
  const withSlotSelect = `${requiredSelect},slot`;

  const withSlot = await admin.from("orders").select(withSlotSelect).limit(1);
  if (!withSlot.error) {
    ordersSchemaCache = { hasSlot: true, checkedAt: now };
    return ordersSchemaCache;
  }

  if (isMissingColumnError(withSlot.error, "slot")) {
    const requiredOnly = await admin.from("orders").select(requiredSelect).limit(1);
    if (requiredOnly.error) {
      throw new Error(`ORDERS_SCHEMA_VERIFY_FAILED:${safeStr(requiredOnly.error.message) || "unknown"}`);
    }
    ordersSchemaCache = { hasSlot: false, checkedAt: now };
    return ordersSchemaCache;
  }

  throw new Error(`ORDERS_SCHEMA_VERIFY_FAILED:${safeStr(withSlot.error.message) || "unknown"}`);
}

export async function GET(req: NextRequest) {
  const auth = await scopeOr401(req);
  if (auth.ok === false) return auth.res;

  const { rid, scope } = auth.ctx;

  const denyRole = requireRoleOr403(auth.ctx, "api.orders.week.GET", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(auth.ctx);
  if (denyScope) return denyScope;

  const userId = safeStr(scope.userId);
  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);
  if (!userId || !companyId) {
    return jsonErr(rid, "Mangler brukerprofil.", 409, "PROFILE_MISSING");
  }

  const weekRaw = safeStr(req.nextUrl.searchParams.get("week"));
  const requestedMonday = weekRaw ? parseWeekToMonday(weekRaw) : startOfWeekISO(osloTodayISODate());
  if (!requestedMonday || !isIsoDate(requestedMonday)) {
    return jsonErr(rid, "Ugyldig week. Bruk format YYYY-WW.", 400, "BAD_WEEK");
  }

  const currentMonday = startOfWeekISO(osloTodayISODate());
  const nextMonday = addDaysISO(currentMonday, 7);
  if (requestedMonday < currentMonday || requestedMonday > nextMonday) {
    return jsonErr(rid, "Kun denne og neste uke er tillatt.", 400, "WEEK_OUT_OF_RANGE");
  }

  let schema: OrdersSchema;
  try {
    schema = await verifyOrdersSchema();
  } catch (e: any) {
    return jsonErr(rid, "Orders-schema kunne ikke verifiseres.", 500, "SCHEMA_MISMATCH", {
      message: safeStr(e?.message ?? e),
    });
  }

  const days = weekDays(requestedMonday);
  const slotParam = safeStr(req.nextUrl.searchParams.get("slot"));
  if (slotParam && !schema.hasSlot) {
    return jsonErr(rid, "Slot-filter stottes ikke av gjeldende schema.", 400, "SLOT_UNSUPPORTED");
  }

  const sb = await supabaseServer();
  const selectColumns = schema.hasSlot
    ? "id,date,status,note,created_at,updated_at,slot"
    : "id,date,status,note,created_at,updated_at";

  let q = sb
    .from("orders")
    .select(selectColumns)
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .gte("date", days[0])
    .lte("date", days[4])
    .order("date", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (locationId) {
    q = q.eq("location_id", locationId);
  }

  if (slotParam && schema.hasSlot) {
    q = q.eq("slot", slotParam);
  }

  const { data, error } = await q;
  if (error) {
    if (
      isAnyMissingColumnError(error, [
        "user_id",
        "company_id",
        "location_id",
        "date",
        "status",
        "note",
        "created_at",
        "updated_at",
        "slot",
      ])
    ) {
      return jsonErr(rid, "Orders-schema matcher ikke forventet kontrakt.", 500, "SCHEMA_MISMATCH", {
        message: error.message,
      });
    }
    return jsonErr(rid, "Kunne ikke hente ukebestillinger.", 500, "DB_ERROR", { message: error.message });
  }

  // Max one Sanity call per request, or a server-side cache hit.
  const published = await getPublishedDatesCached(days).catch(() => new Set<string>());

  const bestByDate = new Map<string, WeekOrderRow>();
  for (const row of ((data ?? []) as unknown as WeekOrderRow[])) {
    const date = safeStr(row?.date);
    if (!date || bestByDate.has(date)) continue;
    bestByDate.set(date, row);
  }

  const out = days.map((date) => {
    const row = bestByDate.get(date) ?? null;
    const status = mapOrderStatus(row?.status ?? null);
    return {
      date,
      menuPublished: published.has(date),
      status,
      note: row?.note ?? null,
      receipt: row
        ? receiptFor(row.id, status ?? "UNKNOWN", row.updated_at ?? row.created_at ?? undefined)
        : null,
    };
  });

  return jsonOk(rid, { days: out });
}
