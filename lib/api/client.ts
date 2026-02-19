// lib/api/client.ts
// A2 — Transport layer (idempotent + fail-closed) for Lunchportalen
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
  return apiFetch<CancelResponse>(
    "/api/orders/cancel",
    {
      method: "POST",
      body: JSON.stringify({ date, slot: slot ?? null, note: note ?? null }),
    },
    opts
  );
}

export async function upsertOrder(
  date: string,
  slotStart: string,
  slotEnd: string,
  note?: string | null,
  opts: FetchOpts = {}
): Promise<ApiResp<UpsertResponse>> {
  return apiFetch<UpsertResponse>(
    "/api/orders/upsert",
    {
      method: "POST",
      body: JSON.stringify({ date, slotStart, slotEnd, note: note ?? null }),
    },
    opts
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
