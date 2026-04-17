// lib/server/kitchen/materializeProductionOperativeSnapshot.ts
/** Materialiser låst sett operative ordre-id for firma+dato (samme read-model som loadOperativeKitchenOrders). */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadOperativeKitchenOrders } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i.test(v)
  );
}

export type MaterializeProductionOperativeSnapshotResult =
  | { ok: true; delivery_date: string; company_id: string; order_count: number; frozen_at: string }
  | { ok: false; message: string };

export async function materializeProductionOperativeSnapshot(
  admin: SupabaseClient,
  args: { dateISO: string; companyId: string }
): Promise<MaterializeProductionOperativeSnapshotResult> {
  const delivery_date = safeStr(args.dateISO);
  const company_id = safeStr(args.companyId);
  if (!isISODate(delivery_date)) {
    return { ok: false, message: "Ugyldig dato (YYYY-MM-DD)." };
  }
  if (!isUuid(company_id)) {
    return { ok: false, message: "Ugyldig company_id." };
  }

  const loaded = await loadOperativeKitchenOrders({
    admin,
    dateISO: delivery_date,
    tenant: { companyId: company_id },
  });

  if (loaded.ok === false) {
    return { ok: false, message: loaded.dbError.message };
  }

  const order_ids = loaded.operative.map((r) => safeStr(r.id)).filter(isUuid);
  const frozen_at = new Date().toISOString();

  const { error: upErr } = await admin.from("production_operative_snapshots").upsert(
    { delivery_date, company_id, order_ids, frozen_at },
    { onConflict: "delivery_date,company_id" }
  );

  if (upErr) {
    opsLog("kitchen.snapshot.upsert_failed", {
      delivery_date,
      company_id,
      order_count: order_ids.length,
      code: (upErr as { code?: string })?.code ?? null,
      detail: safeStr(upErr.message),
    });
    return { ok: false, message: safeStr(upErr.message) };
  }

  return {
    ok: true,
    delivery_date,
    company_id,
    order_count: order_ids.length,
    frozen_at,
  };
}
