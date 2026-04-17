import type { SystemTestContext } from "../context";
import { createEmployeeRpcClient } from "../utils/authedEmployeeClient";

function parseRpcOrderPayload(data: unknown): { order_id?: string; status?: string } | null {
  if (data == null) return null;
  if (typeof data === "object" && !Array.isArray(data)) return data as { order_id?: string; status?: string };
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") return data[0] as { order_id?: string; status?: string };
  return null;
}

/**
 * Cancel via public.lp_order_set only — authenticated JWT (auth.uid() in Postgres).
 */
export async function cancelOrder(ctx: SystemTestContext): Promise<SystemTestContext> {
  if (!ctx.orderDateISO) throw new Error("cancelOrder: missing orderDateISO");
  if (!ctx.employeePassword || !String(ctx.employeeEmail ?? "").trim()) {
    throw new Error("cancelOrder: missing employeeEmail or employeePassword");
  }
  if (!ctx.userId || !ctx.companyId || !ctx.locationId) {
    throw new Error("cancelOrder: missing userId, companyId, or locationId");
  }
  if (!ctx.orderId) throw new Error("cancelOrder: missing orderId");

  const client = await createEmployeeRpcClient(ctx.employeeEmail, ctx.employeePassword);

  const { data, error } = await client.rpc("lp_order_set", {
    p_date: ctx.orderDateISO,
    p_action: "CANCEL",
    p_note: "",
    p_slot: "default",
  });

  if (error) {
    throw new Error(`CANCEL_RPC_FAILED: ${error.message}`);
  }

  const row = parseRpcOrderPayload(data);
  if (!row) {
    throw new Error("CANCEL_RPC_FAILED");
  }
  const raw = row as { status?: unknown; order_status?: unknown; order_id?: unknown };
  const st = String(raw.status ?? raw.order_status ?? "").toUpperCase();
  if (st.includes("CANCEL")) {
    return ctx;
  }
  if (raw.order_id != null && String(raw.order_id).trim() !== "" && !st) {
    return ctx;
  }
  throw new Error(`CANCEL_RPC_FAILED: unexpected status ${String(raw.status ?? raw.order_status ?? "")}`);
}
