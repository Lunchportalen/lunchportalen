// lib/server/kitchen/fetchProductionOperativeSnapshotAllowlist.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type ProductionOperativeSnapshotAllowlist =
  | { found: false }
  | { found: true; orderIds: ReadonlySet<string>; frozenAt: string | null };

/**
 * Leser materialisert produksjons-grunnlag for firma+dato.
 * `found: false` = ingen snapshot-rad → kjøkken/sjåfør bruker live operative modell.
 */
export async function fetchProductionOperativeSnapshotAllowlist(
  admin: SupabaseClient,
  args: { dateISO: string; companyId: string }
): Promise<ProductionOperativeSnapshotAllowlist> {
  const date = safeStr(args.dateISO);
  const companyId = safeStr(args.companyId);
  if (!date || !companyId) return { found: false };

  const { data: rows, error } = await admin
    .from("production_operative_snapshots")
    .select("order_ids, frozen_at")
    .eq("delivery_date", date)
    .eq("company_id", companyId)
    .limit(1);

  if (error) {
    const m = safeStr(error.message).toLowerCase();
    if (m.includes("does not exist") || m.includes("relation") || m.includes("schema cache")) {
      return { found: false };
    }
    opsLog("kitchen.snapshot.db_read_failed", {
      delivery_date: date,
      company_id: companyId,
      code: (error as { code?: string })?.code ?? null,
      detail: safeStr(error.message),
    });
    return { found: false };
  }

  const data = Array.isArray(rows) && rows.length ? (rows[0] as Record<string, unknown>) : null;
  if (!data) return { found: false };

  const raw = (data as { order_ids?: unknown; frozen_at?: unknown }).order_ids;
  const ids = Array.isArray(raw) ? raw : [];
  const orderIds = new Set(ids.map((x) => safeStr(x)).filter(Boolean));

  const frozenAt =
    (data as { frozen_at?: unknown }).frozen_at != null ? safeStr((data as { frozen_at: unknown }).frozen_at) : null;

  return { found: true, orderIds, frozenAt };
}
