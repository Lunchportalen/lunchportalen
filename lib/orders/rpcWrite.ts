// lib/orders/rpcWrite.ts

type RpcError =
  | { message?: string | null; code?: string | null; details?: unknown; hint?: string | null }
  | null;

type RpcResult = {
  data: unknown;
  error: RpcError;
};

export type RpcClient = {
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<RpcResult>;
};

type OrderRpcInput = {
  p_user_id?: string | null;
  p_company_id?: string | null;
  p_location_id?: string | null;
  p_date: string;
  p_slot?: string | null;
  p_note?: string | null;
  p_action?: string | null;
};

function pickFirstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return null;
}

export function mapOrderRpcErrorCode(msg: string): string {
  const m = String(msg ?? "").toUpperCase();

  if (m.includes("NO_ACTIVE_AGREEMENT") || m.includes("AGREEMENT_MISSING")) return "NO_ACTIVE_AGREEMENT";
  if (m.includes("OUTSIDE_DELIVERY_DAYS") || m.includes("AGREEMENT_DAY_NOT_DELIVERY")) return "OUTSIDE_DELIVERY_DAYS";
  if (m.includes("CUTOFF_PASSED") || m.includes("CUTOFF")) return "CUTOFF_PASSED";
  if (m.includes("SCOPE_FORBIDDEN")) return "FORBIDDEN_SCOPE";
  if (m.includes("PROFILE_MISSING")) return "PROFILE_MISSING";
  if (m.includes("UNAUTH") || m.includes("AUTH")) return "UNAUTHENTICATED";
  if (m.includes("ACTION_INVALID")) return "ACTION_INVALID";
  if (m.includes("DATE_REQUIRED")) return "DATE_REQUIRED";
  if (m.includes("SLOT")) return "INVALID_SLOT";
  return "ORDER_RPC_FAILED";
}

function buildRpcParams(input: OrderRpcInput): Record<string, unknown> {
  const params: Record<string, unknown> = {
    p_date: input.p_date,
    p_action: String(input.p_action ?? "SET").toUpperCase(),
    p_note: input.p_note ?? null,
    p_slot: input.p_slot ?? "lunch",
  };

  if (input.p_user_id) params.p_user_id = input.p_user_id;
  if (input.p_company_id) params.p_company_id = input.p_company_id;
  if (input.p_location_id) params.p_location_id = input.p_location_id;

  return params;
}

async function callOrderSet(sb: RpcClient, input: OrderRpcInput) {
  return sb.rpc("lp_order_set", buildRpcParams(input));
}

export async function lpOrderSet(
  sb: RpcClient,
  input: {
    p_user_id?: string | null;
    p_company_id?: string | null;
    p_location_id?: string | null;
    p_date: string;
    p_slot: string;
    p_note: string | null;
  }
) {
  const rpc = await callOrderSet(sb, {
    ...input,
    p_action: "SET",
  });

  if (rpc.error) {
    return {
      ok: false as const,
      error: rpc.error,
      code: mapOrderRpcErrorCode(String(rpc.error?.message ?? "")),
    };
  }

  return { ok: true as const, row: pickFirstRow(rpc.data) };
}

export async function lpOrderCancel(
  sb: RpcClient,
  input: {
    p_user_id?: string | null;
    p_company_id?: string | null;
    p_location_id?: string | null;
    p_date: string;
    p_slot?: string | null;
  }
) {
  const rpc = await callOrderSet(sb, {
    ...input,
    p_action: "CANCEL",
    p_note: null,
    p_slot: input.p_slot ?? "lunch",
  });

  if (rpc.error) {
    return {
      ok: false as const,
      error: rpc.error,
      code: mapOrderRpcErrorCode(String(rpc.error?.message ?? "")),
    };
  }

  return { ok: true as const, row: pickFirstRow(rpc.data) };
}
