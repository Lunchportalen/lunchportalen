"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  cancelOrder as cancelOrderApi,
  upsertOrder as upsertOrderApi,
  toUiResult,
  isRetryable,
  retryAfterSeconds,
  type ApiResp,
  type CancelResponse,
  type UpsertResponse,
  type ApiErr,
} from "@/lib/api/client";
import { getOrderAttributionForApi } from "@/lib/revenue/attributionSessionBrowser";

export type OrderAction = "UPSERT" | "CANCEL";
type InFlightKey = `${OrderAction}:${string}`;

type LastCall =
  | { action: "CANCEL"; date: string; slot?: string | null; note?: string | null }
  | { action: "UPSERT"; date: string; slotStart: string; slotEnd: string; note?: string | null };

export type ReceiptState = {
  rid: string;
  ok: boolean;
  action: OrderAction;
  date: string;
  orderId: string | null;
  status: string | null;
  timestamp: string;
  message?: string | null;
  code?: string | null;
};

export type ActionErrorState = {
  rid: string;
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
};

export type UseOrderActionsOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  onAttempt?: (info: { action: OrderAction; date: string; attempt: number; rid: string }) => void;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function idemKey() {
  return crypto.randomUUID();
}

function k(action: OrderAction, date: string): InFlightKey {
  return `${action}:${date}`;
}

function isErr<T>(resp: ApiResp<T>): resp is ApiErr {
  return resp.ok === false;
}

function mkErr(code: string, message: string, detail?: unknown): ApiErr {
  return {
    ok: false,
    rid: crypto.randomUUID(),
    error: { code, message, detail },
  };
}

function errorFrom<T>(resp: ApiResp<T>): ActionErrorState | null {
  if (!isErr(resp)) return null;
  const ui = toUiResult(resp);
  return {
    rid: ui.rid,
    code: ui.code ?? "ERROR",
    message: ui.message ?? "Feil",
    retryable: isRetryable(resp),
    retryAfterSeconds: retryAfterSeconds(resp),
  };
}

function receiptFromUpsert(date: string, resp: ApiResp<UpsertResponse>): ReceiptState {
  if (isErr(resp)) {
    const ui = toUiResult(resp);
    return {
      rid: ui.rid,
      ok: false,
      action: "UPSERT",
      date,
      orderId: null,
      status: null,
      timestamp: nowIso(),
      code: ui.code,
      message: ui.message,
    };
  }

  const r = resp.data?.receipt;
  return {
    rid: resp.rid,
    ok: true,
    action: "UPSERT",
    date,
    orderId: r?.orderId ?? null,
    status: r?.status ?? null,
    timestamp: r?.timestamp ?? nowIso(),
  };
}

function receiptFromCancel(date: string, resp: ApiResp<CancelResponse>): ReceiptState {
  if (isErr(resp)) {
    const ui = toUiResult(resp);
    return {
      rid: ui.rid,
      ok: false,
      action: "CANCEL",
      date,
      orderId: null,
      status: null,
      timestamp: nowIso(),
      code: ui.code,
      message: ui.message,
    };
  }

  const o = resp.data?.order;
  return {
    rid: resp.rid,
    ok: true,
    action: "CANCEL",
    date,
    orderId: o?.id ?? null,
    status: o?.status ?? "CANCELLED",
    timestamp: o?.saved_at ?? nowIso(),
  };
}

export function useOrderActions(options: UseOrderActionsOptions = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 250;

  const inFlight = useRef<Map<InFlightKey, boolean>>(new Map());
  const aborters = useRef<Map<InFlightKey, AbortController>>(new Map());
  const lastCall = useRef<LastCall | null>(null);

  const [loadingKey, setLoadingKey] = useState<InFlightKey | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [error, setError] = useState<ActionErrorState | null>(null);

  const isBusy = useMemo(() => loadingKey !== null, [loadingKey]);

  const clear = useCallback(() => {
    setReceipt(null);
    setError(null);
  }, []);

  const cancelInFlight = useCallback((action: OrderAction, date: string) => {
    const key = k(action, date);
    const ac = aborters.current.get(key);
    if (ac) ac.abort();
    aborters.current.delete(key);
    inFlight.current.delete(key);
    setLoadingKey((cur) => (cur === key ? null : cur));
  }, []);

  const runWithRetry = useCallback(
    async <T,>(
      action: OrderAction,
      date: string,
      fn: (idem: string, signal: AbortSignal) => Promise<ApiResp<T>>
    ) => {
      const key = k(action, date);

      if (inFlight.current.get(key)) {
        return mkErr("IN_FLIGHT", "Handling pågår allerede.") as unknown as ApiResp<T>;
      }

      inFlight.current.set(key, true);
      setLoadingKey(key);
      setError(null);

      const ac = new AbortController();
      aborters.current.set(key, ac);

      const idem = idemKey();
      let last: ApiResp<T> | null = null;

      try {
        for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
          if (ac.signal.aborted) {
            return mkErr("ABORTED", "Avbrutt.") as unknown as ApiResp<T>;
          }

          const resp = await fn(idem, ac.signal);
          last = resp;

          options.onAttempt?.({ action, date, attempt, rid: resp.rid });

          if (!isErr(resp)) return resp;
          if (!isRetryable(resp)) return resp;

          const ra = retryAfterSeconds(resp);
          if (typeof ra === "number" && ra > 0) {
            await sleep(ra * 1000);
          } else {
            const delay = Math.min(5000, baseDelayMs * Math.pow(2, attempt - 1));
            await sleep(delay);
          }
        }

        return last ?? (mkErr("UNKNOWN", "Ukjent feil.") as unknown as ApiResp<T>);
      } finally {
        inFlight.current.delete(key);
        aborters.current.delete(key);
        setLoadingKey(null);
      }
    },
    [baseDelayMs, maxRetries, options]
  );

  const cancelOrder = useCallback(
    async (date: string, slot?: string | null, note?: string | null) => {
      lastCall.current = { action: "CANCEL", date, slot, note };

      const resp = await runWithRetry<CancelResponse>("CANCEL", date, (idem, signal) =>
        cancelOrderApi(date, slot ?? null, note ?? null, { idemKey: idem, signal })
      );

      setReceipt(receiptFromCancel(date, resp));
      setError(errorFrom(resp));
      return resp;
    },
    [runWithRetry]
  );

  const upsertOrder = useCallback(
    async (date: string, slotStart: string, slotEnd: string, note?: string | null) => {
      lastCall.current = { action: "UPSERT", date, slotStart, slotEnd, note };

      const resp = await runWithRetry<UpsertResponse>("UPSERT", date, (idem, signal) => {
        const attribution = getOrderAttributionForApi();
        return upsertOrderApi(date, slotStart, slotEnd, note ?? null, {
          idemKey: idem,
          signal,
          ...(attribution ? { attribution } : {}),
        });
      });

      setReceipt(receiptFromUpsert(date, resp));
      setError(errorFrom(resp));
      return resp;
    },
    [runWithRetry]
  );

  const retryLast = useCallback(async () => {
    if (!lastCall.current) return null;

    const c = lastCall.current;

    if (c.action === "CANCEL") {
      return cancelOrder(c.date, c.slot ?? null, c.note ?? null);
    }

    return upsertOrder(c.date, c.slotStart, c.slotEnd, c.note ?? null);
  }, [cancelOrder, upsertOrder]);

  const lastUi = useMemo(() => {
    if (!receipt) return null;
    return receipt.ok
      ? { ok: true, rid: receipt.rid }
      : { ok: false, rid: receipt.rid, code: receipt.code, message: receipt.message };
  }, [receipt]);

  return {
    isBusy,
    loadingKey,
    receipt,
    error,
    lastUi,

    cancelOrder,
    upsertOrder,
    retryLast,
    cancelInFlight,
    clear,
  };
}
