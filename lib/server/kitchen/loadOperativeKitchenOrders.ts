// lib/server/kitchen/loadOperativeKitchenOrders.ts
/** Én operativ ordrelesing: samme filterkjede som GET /api/kitchen (ACTIVE + day_choices ≠ CANCELLED). */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i.test(v)
  );
}

/** Aligner med GET /api/kitchen — operativ grouping på leveringsvindu. */
export function normKitchenSlot(v: unknown) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

export type OperativeKitchenOrderRow = {
  id: string;
  user_id: string;
  company_id: string;
  location_id: string;
  note: string | null;
  status: string;
  slot: string | null;
};

export type KitchenDayChoiceMapEntry = {
  choice_key: string;
  note: string | null;
  updated_at: string | null;
  status: string | null;
};

/** `system` = superadmin kjøkken / produksjonslesing (alle firma for dato). Ellers tenant som kjøkkenrolle / sjåfør. */
export type OperativeKitchenTenant = { companyId: string; locationId?: string | null } | "system";

export type LoadOperativeKitchenOrdersResult =
  | {
      ok: true;
      raw: OperativeKitchenOrderRow[];
      list0: OperativeKitchenOrderRow[];
      operative: OperativeKitchenOrderRow[];
      dcMap: Map<string, KitchenDayChoiceMapEntry>;
    }
  | { ok: false; dbError: { message: string; code?: string } };

/** Filtrer operative rader til låst produksjonsgrunnlag (snapshot av ordre-id). */
export function filterOperativeByProductionAllowlist(
  operative: OperativeKitchenOrderRow[],
  allowlist: ReadonlySet<string>
): OperativeKitchenOrderRow[] {
  return operative.filter((r) => allowlist.has(safeStr(r.id)));
}

export async function loadOperativeKitchenOrders(args: {
  admin: SupabaseClient;
  dateISO: string;
  tenant: OperativeKitchenTenant;
  /** Når satt: operative rader filtreres til disse ordre-id (canonical freeze). */
  productionFreezeAllowlist?: ReadonlySet<string>;
}): Promise<LoadOperativeKitchenOrdersResult> {
  const { admin, dateISO, tenant, productionFreezeAllowlist } = args;
  const date = safeStr(dateISO);

  let ordersQ = admin
    .from("orders")
    .select("id,user_id,company_id,location_id,note,status,slot")
    .eq("date", date)
    .in("status", ["ACTIVE", "active"]);

  if (tenant !== "system") {
    ordersQ = ordersQ.eq("company_id", safeStr(tenant.companyId));
    const lid = safeStr(tenant.locationId ?? "");
    if (lid) ordersQ = ordersQ.eq("location_id", lid);
  }

  const { data: orders, error: oErr } = await ordersQ;
  if (oErr) {
    return {
      ok: false as const,
      dbError: { message: safeStr(oErr.message), code: oErr.code != null ? String(oErr.code) : undefined },
    };
  }

  const raw = (orders ?? []) as OperativeKitchenOrderRow[];

  const list0 = raw.filter((r) => safeStr(r.company_id) && safeStr(r.location_id) && safeStr(r.user_id));

  const userIds0 = Array.from(new Set(list0.map((r) => safeStr(r.user_id)).filter((x) => isUuid(x))));

  const dcMap = new Map<string, KitchenDayChoiceMapEntry>();
  if (userIds0.length) {
    let dcQ = admin
      .from("day_choices")
      .select("user_id,company_id,location_id,date,choice_key,note,updated_at,status")
      .eq("date", date)
      .in("user_id", userIds0);
    if (tenant !== "system") {
      dcQ = dcQ.eq("company_id", safeStr(tenant.companyId));
    } else {
      const cids = Array.from(new Set(list0.map((r) => safeStr(r.company_id)).filter((x) => isUuid(x))));
      if (cids.length) dcQ = dcQ.in("company_id", cids);
    }
    const { data: dcRows } = await dcQ;
    for (const row of (dcRows ?? []) as any[]) {
      const cid = safeStr(row.company_id);
      const uid = safeStr(row.user_id);
      const lid = safeStr(row.location_id);
      const k = `${cid}|${lid}|${uid}`;
      const prev = dcMap.get(k);
      const prevT = prev?.updated_at ? new Date(prev.updated_at).getTime() : 0;
      const nextT = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (!prev || nextT >= prevT) {
        dcMap.set(k, {
          choice_key: safeStr(row.choice_key),
          note: row.note != null ? safeStr(row.note) : null,
          updated_at: row.updated_at != null ? String(row.updated_at) : null,
          status: row.status != null ? String(row.status) : null,
        });
      }
    }
  }

  let operative = list0.filter((r) => {
    const cid = safeStr(r.company_id);
    const uid = safeStr(r.user_id);
    const lid = safeStr(r.location_id);
    const dc = dcMap.get(`${cid}|${lid}|${uid}`);
    if (dc && String(dc.status ?? "").toUpperCase() === "CANCELLED") return false;
    return true;
  });

  if (productionFreezeAllowlist) {
    operative = filterOperativeByProductionAllowlist(operative, productionFreezeAllowlist);
  }

  return { ok: true as const, raw, list0, operative, dcMap };
}
