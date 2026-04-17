/**
 * Client-side helpers for GET /api/kitchen (enterprise JSON envelope).
 */

export type KitchenRow = {
  orderId: string;
  slot: string;
  orderStatus: string;
  company: string;
  location: string;
  employeeName: string;
  department?: string | null;
  note?: string | null;
  tier?: "BASIS" | "LUXUS" | null;
  menu_title?: string | null;
  menu_description?: string | null;
  menu_allergens?: string[];
};

export type KitchenResp = {
  ok: boolean;
  date: string;
  cutoff?: { isAfterCutoff: boolean; cutoffTime: string };
  summary: { orders: number; companies: number; people: number };
  rows: KitchenRow[];
  reason?: "NO_ORDERS" | "NOT_DELIVERY_DAY" | "COMPANIES_PAUSED" | "AUTH_REQUIRED" | "ERROR";
  detail?: string;
  /** Satt av GET /api/kitchen for kjøkkenrolle når materialisert snapshot er aktivt filter. */
  production_operative_snapshot?: {
    active: true;
    frozen_at: string | null;
    captured_order_ids: number;
  };
};

function readJsonSafe<T = unknown>(t: string): T | null {
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

/**
 * Normalizes `{ ok, rid, data }` from jsonOk to flat KitchenResp for UI.
 */
export function normalizeKitchenApiResponse(dateISO: string, raw: unknown): KitchenResp {
  const r = raw as Record<string, unknown> | null;
  const ok = Boolean(r?.ok);

  if (!ok) {
    return {
      ok: false,
      date: dateISO,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: "ERROR",
      detail: String((r?.message as string) ?? (r?.error as string) ?? ""),
    };
  }

  const inner =
    r && typeof r === "object" && "data" in r && r.data != null && typeof r.data === "object"
      ? (r.data as Record<string, unknown>)
      : (r as Record<string, unknown>);

  const date = String(inner?.date ?? dateISO);
  const summaryIn = (inner?.summary as Record<string, unknown>) ?? {};
  const summary = {
    orders: Number(summaryIn?.orders ?? 0),
    companies: Number(summaryIn?.companies ?? 0),
    people: Number(summaryIn?.people ?? 0),
  };

  const rows: KitchenRow[] = Array.isArray(inner?.rows) ? (inner.rows as KitchenRow[]) : [];
  const cutoffRaw = inner?.cutoff;
  const cutoff =
    cutoffRaw && typeof cutoffRaw === "object"
      ? {
          isAfterCutoff: Boolean((cutoffRaw as { isAfterCutoff?: boolean }).isAfterCutoff),
          cutoffTime: String((cutoffRaw as { cutoffTime?: string }).cutoffTime ?? "08:00"),
        }
      : undefined;

  const reason = inner?.reason as KitchenResp["reason"] | undefined;
  const detail = inner?.detail != null ? String(inner.detail) : undefined;

  const snapRaw = inner?.production_operative_snapshot;
  const production_operative_snapshot =
    snapRaw &&
    typeof snapRaw === "object" &&
    (snapRaw as { active?: unknown }).active === true &&
    "captured_order_ids" in (snapRaw as object)
      ? {
          active: true as const,
          frozen_at:
            (snapRaw as { frozen_at?: unknown }).frozen_at != null
              ? String((snapRaw as { frozen_at: unknown }).frozen_at)
              : null,
          captured_order_ids: Number((snapRaw as { captured_order_ids?: unknown }).captured_order_ids ?? 0),
        }
      : undefined;

  return { ok: true, date, cutoff, summary, rows, reason, detail, production_operative_snapshot };
}

export async function fetchKitchenList(dateISO: string): Promise<KitchenResp> {
  const r = await fetch(`/api/kitchen?date=${encodeURIComponent(dateISO)}`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text();
  const raw = readJsonSafe(text);

  if (!r.ok) {
    return {
      ok: false,
      date: dateISO,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: r.status === 401 ? "AUTH_REQUIRED" : "ERROR",
      detail: `HTTP ${r.status}`,
    };
  }

  return normalizeKitchenApiResponse(dateISO, raw);
}
