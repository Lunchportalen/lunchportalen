import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { pickOrderColumns } from "@/lib/orders/projection";
import { showOrderPricesForApiRole } from "@/lib/orders/projectionRole";
import type { AdminOrderView, EmployeeOrderView } from "@/lib/orders/views";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type OrderRow = Record<string, unknown>;

function rowToEmployeeView(row: OrderRow): EmployeeOrderView {
  const serviceDate = safeStr(row.service_date) || safeStr(row.date);
  return {
    id: safeStr(row.id),
    user_id: safeStr(row.user_id),
    service_date: serviceDate,
    status: safeStr(row.status) as EmployeeOrderView["status"],
    slot: row.slot == null ? null : safeStr(row.slot) || null,
    note: row.note == null ? null : String(row.note),
    cutoff_at: row.cutoff_at == null || safeStr(row.cutoff_at) === "" ? null : safeStr(row.cutoff_at),
    created_at: safeStr(row.created_at),
    updated_at: safeStr(row.updated_at),
  };
}

function rowToAdminView(row: OrderRow): AdminOrderView {
  const base = rowToEmployeeView(row);
  return {
    ...base,
    company_id: safeStr(row.company_id),
    location_id: safeStr(row.location_id),
    unit_price_nok: typeof row.unit_price_nok === "number" ? row.unit_price_nok : row.unit_price_nok == null ? null : Number(row.unit_price_nok),
    subtotal_cents_ex_vat:
      typeof row.subtotal_cents_ex_vat === "number" ? row.subtotal_cents_ex_vat : row.subtotal_cents_ex_vat == null ? null : Number(row.subtotal_cents_ex_vat),
    vat_cents: typeof row.vat_cents === "number" ? row.vat_cents : row.vat_cents == null ? null : Number(row.vat_cents),
    gross_cents_inc_vat:
      typeof row.gross_cents_inc_vat === "number"
        ? row.gross_cents_inc_vat
        : row.gross_cents_inc_vat == null
          ? null
          : Number(row.gross_cents_inc_vat),
  };
}

export async function getOrderForScopedUser(
  sb: SupabaseClient,
  input: {
    orderId: string;
    companyId: string;
    locationId: string;
    userId: string;
    role: string | null | undefined;
  },
): Promise<{ kind: "employee"; order: EmployeeOrderView } | { kind: "admin"; order: AdminOrderView } | null> {
  const showPrices = showOrderPricesForApiRole(input.role);
  const cols = pickOrderColumns(showPrices);

  let q = sb
    .from("orders")
    .select(cols)
    .eq("id", input.orderId)
    .eq("company_id", input.companyId)
    .eq("location_id", input.locationId);

  const r = safeStr(input.role).toLowerCase();
  if (r === "employee") {
    q = q.eq("user_id", input.userId);
  }

  const { data, error } = await q.maybeSingle<OrderRow>();

  if (error || !data) return null;

  if (showPrices) {
    return { kind: "admin", order: rowToAdminView(data) };
  }
  return { kind: "employee", order: rowToEmployeeView(data) };
}
