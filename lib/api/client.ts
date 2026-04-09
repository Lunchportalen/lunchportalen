// lib/api/client.ts
// A2 — Transport layer (idempotent + fail-closed) for Lunchportalen

import type { OrderAttributionRecord } from "@/lib/revenue/types";
// - Always returns ApiResp<T> (never throws for normal failures)
// - Adds Idempotency-Key automatically (or accepts explicit key)
// - Fail-closed if API breaks contract
// - Helpers: isRetryable, retryAfterSeconds, toUiResult

export type ApiOk<T> = {
  ok: true;
  rid: string;
  data: T;
};

export type ApiErr = {
  ok: false;
  rid: string;
  error: {
    code: string;
    message: string;
    detail?: unknown;
  };
};

export type ApiResp<T> = ApiOk<T> | ApiErr;

export type OrderReceipt = {
  rid: string;
  orderId: string | null;
  status: string | null;
  timestamp: string;
};

export type CancelResponse = {
  order: {
    id: string | null;
    date: string;
    status: "CANCELLED";
    note: string | null;
    slot: string | null;
    created_at: string | null;
    updated_at: string | null;
    saved_at: string;
  };
  pricing: { tier: "BASIS" | "LUXUS"; unit_price: number };
  backup: { ok: boolean; [k: string]: any };
};

export type UpsertResponse = {
  receipt: OrderReceipt;
  order: Record<string, any> | null;
};

/* =========================================================
   Type guards (fixes TS union narrowing)
========================================================= */

function isApiOk<T>(resp: ApiResp<T>): resp is ApiOk<T> {
  return resp.ok === true;
}

function isApiErr<T>(resp: ApiResp<T>): resp is ApiErr {
  return resp.ok === false;
}

/* =========================================================
   Helpers
========================================================= */

function makeRidFallback() {
  try {
    return crypto.randomUUID();
  } catch {
    return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function makeIdemKey() {
  // UUID is perfect for Idempotency-Key
  return makeRidFallback();
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toHeaders(h?: HeadersInit) {
  return h instanceof Headers ? h : new Headers(h ?? {});
}

/* =========================================================
   Core fetch
========================================================= */

export type FetchOpts = {
  /** Optional explicit idempotency key. If omitted, generated. */
  idemKey?: string;
  /** Optional AbortSignal. */
  signal?: AbortSignal;
};

export type OrderUpsertFetchOpts = FetchOpts & {
  /** Sendes til server ved suksess — persisteres på ordre (jsonb) når gyldig. */
  attribution?: OrderAttributionRecord | null;
};

export async function apiFetch<T>(url: string, init: RequestInit, opts: FetchOpts = {}): Promise<ApiResp<T>> {
  const idemKey = (opts.idemKey ?? makeIdemKey()).trim();

  const headers = toHeaders(init.headers);

  // default headers
  if (!headers.get("cache-control")) headers.set("cache-control", "no-store");
  if (init.body && !headers.get("content-type")) headers.set("content-type", "application/json");

  // idempotency
  headers.set("Idempotency-Key", idemKey);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: opts.signal, cache: "no-store" });
  } catch (e: any) {
    const rid = makeRidFallback();
    return {
      ok: false,
      rid,
      error: {
        code: "NETWORK_ERROR",
        message: "Nettverksfeil. Prøv igjen.",
        detail: { message: String(e?.message ?? e), url },
      },
    };
  }

  const json = await safeJson(res);

  // Must honor server contract if provided
  if (json && typeof json === "object" && (json as any).ok === true && typeof (json as any).rid === "string") {
    // ApiOk<T> expected shape
    if ("data" in (json as any)) return json as ApiOk<T>;
  }
  if (json && typeof json === "object" && (json as any).ok === false && typeof (json as any).rid === "string") {
    // ApiErr expected shape
    if ("error" in (json as any) && typeof (json as any).error?.code === "string") return json as ApiErr;
  }

  // Fail-closed if API broke the contract
  const rid = (json && typeof (json as any)?.rid === "string" ? (json as any).rid : makeRidFallback()) as string;

  return {
    ok: false,
    rid,
    error: {
      code: "BAD_API_CONTRACT",
      message: "Uventet API-respons (fail-closed).",
      detail: { status: res.status, url, body: json },
    },
  };
}

/* =========================================================
   Domain wrappers: Orders
========================================================= */

export async function cancelOrder(
  date: string,
  slot?: string | null,
  note?: string | null,
  opts: FetchOpts = {}
): Promise<ApiResp<CancelResponse>> {
  const idemKey = (opts.idemKey ?? makeIdemKey()).trim();
  const headers = toHeaders(undefined);
  if (!headers.get("cache-control")) headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");
  headers.set("Idempotency-Key", idemKey);

  let res: Response;
  try {
    res = await fetch("/api/order/cancel", {
      method: "POST",
      headers,
      body: JSON.stringify({ date }),
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e: any) {
    const rid = makeRidFallback();
    return {
      ok: false,
      rid,
      error: {
        code: "NETWORK_ERROR",
        message: "Nettverksfeil. Prøv igjen.",
        detail: { message: String(e?.message ?? e), url: "/api/order/cancel" },
      },
    };
  }

  const json = (await safeJson(res)) as Record<string, unknown> | null;
  const rid = typeof json?.rid === "string" ? json.rid : makeRidFallback();

  if (json && json.ok === true && json.data !== undefined && typeof json.data === "object") {
    const d = json.data as Record<string, unknown>;
    const receipt = (d.receipt ?? null) as Record<string, unknown> | null;
    const savedAt = new Date().toISOString();
    const mapped: CancelResponse = {
      order: {
        id: receipt?.orderId != null ? String(receipt.orderId) : null,
        date: String(d.date ?? date),
        status: "CANCELLED",
        note: note ?? null,
        slot: slot ?? null,
        created_at: null,
        updated_at: receipt?.updatedAt != null ? String(receipt.updatedAt) : null,
        saved_at: savedAt,
      },
      pricing: { tier: "BASIS", unit_price: 0 },
      backup: { ok: true, source: "order_cancel" },
    };
    return { ok: true, rid, data: mapped };
  }

  if (json && json.ok === false) {
    const errField = json.error;
    const code =
      typeof errField === "string"
        ? errField
        : errField && typeof errField === "object" && typeof (errField as { code?: string }).code === "string"
          ? String((errField as { code: string }).code)
          : "ERROR";
    return {
      ok: false,
      rid,
      error: {
        code,
        message: String(json.message ?? "Feil"),
        detail: json.detail,
      },
    };
  }

  return {
    ok: false,
    rid,
    error: {
      code: "BAD_API_CONTRACT",
      message: "Uventet API-respons (fail-closed).",
      detail: { status: res.status, url: "/api/order/cancel", body: json },
    },
  };
}

export async function upsertOrder(
  date: string,
  slotStart: string,
  slotEnd: string,
  note?: string | null,
  opts: OrderUpsertFetchOpts = {}
): Promise<ApiResp<UpsertResponse>> {
  const { attribution, ...fetchOpts } = opts;
  const payload: Record<string, unknown> = {
    date,
    slotStart,
    slotEnd,
    note: note ?? null,
  };
  if (attribution?.postId && attribution.source === "ai_social") {
    payload.attribution = {
      postId: attribution.postId,
      source: attribution.source,
      ...(attribution.productId ? { productId: attribution.productId } : {}),
      ...(typeof attribution.capturedAt === "number" ? { capturedAt: attribution.capturedAt } : {}),
    };
  }
  return apiFetch<UpsertResponse>(
    "/api/orders/upsert",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    fetchOpts
  );
}

/* =========================================================
   UI helpers (deterministic)
========================================================= */

export function toUiResult<T>(resp: ApiResp<T>): {
  ok: boolean;
  rid: string;
  code?: string;
  message?: string;
  data?: T;
} {
  if (isApiOk(resp)) return { ok: true, rid: resp.rid, data: resp.data };

  return {
    ok: false,
    rid: resp.rid,
    code: resp.error.code,
    message: resp.error.message,
  };
}

/**
 * Standard retry decision:
 * - Retryable: NETWORK_ERROR, RATE_LIMITED, RATE_LIMIT_CHECK_FAILED
 * - Non-retryable: validation/cutoff/enforcement
 */
export function isRetryable<T>(resp: ApiResp<T>) {
  if (!isApiErr(resp)) return false;
  const c = resp.error.code;
  return c === "NETWORK_ERROR" || c === "RATE_LIMITED" || c === "RATE_LIMIT_CHECK_FAILED";
}

/**
 * Extract Retry-After if present in detail
 */
export function retryAfterSeconds<T>(resp: ApiResp<T>): number | null {
  if (!isApiErr(resp)) return null;
  const d = resp.error.detail as any;
  const v = d?.retry_after_seconds;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
