import type { SystemTestContext } from "../context";
import { assert } from "../utils/assert";
import { createEmployeeRpcClient } from "../utils/authedEmployeeClient";

function parseRpcOrderPayload(data: unknown): { order_id?: string } | null {
  if (data == null) return null;
  if (typeof data === "object" && !Array.isArray(data)) return data as { order_id?: string };
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") return data[0] as { order_id?: string };
  return null;
}

/**
 * Place order via public.lp_order_set only — authenticated JWT (auth.uid() in Postgres).
 */
export async function createOrder(ctx: SystemTestContext): Promise<SystemTestContext> {
  if (!ctx.companyId || !ctx.locationId || !ctx.userId) {
    throw new Error("createOrder: missing companyId, locationId, or userId");
  }
  if (!ctx.employeePassword || !String(ctx.employeeEmail ?? "").trim()) {
    throw new Error("createOrder: missing employeeEmail or employeePassword (createEmployee must run first)");
  }

  const client = await createEmployeeRpcClient(ctx.employeeEmail, ctx.employeePassword);

  const { data: activeRows, error: aErr } = await client
    .from("agreements")
    .select("id, status")
    .eq("company_id", ctx.companyId)
    .eq("location_id", ctx.locationId)
    .eq("status", "ACTIVE")
    .limit(2);

  if (aErr) throw new Error(`createOrder: agreement assert failed: ${aErr.message}`);
  assert(Array.isArray(activeRows) && activeRows.length >= 1, "createOrder: no ACTIVE agreement for company_id + location_id");

  const { data, error } = await client.rpc("lp_order_set", {
    p_date: ctx.orderDateISO,
    p_action: "SET",
    p_note: "",
    p_slot: "default",
  });

  if (error) {
    throw new Error(`ORDER_RPC_FAILED: ${error.message}`);
  }

  const row = parseRpcOrderPayload(data);
  const orderId = row?.order_id ? String(row.order_id) : "";
  if (!orderId) {
    throw new Error("ORDER_RPC_FAILED");
  }

  return { ...ctx, orderId };
}
