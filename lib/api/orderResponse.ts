// lib/api/orderResponse.ts

/**
 * =========================================================
 * ORDER API RESPONSE – SINGLE JSON CONTRACT
 * ---------------------------------------------------------
 * - Én fast respons-shape for alle order-endpoints
 * - UI kan stole på feltene (ingen branching)
 * - Norsk dato (DD-MM-YYYY) + ISO internt
 * =========================================================
 */

import { formatDateNO, nowISO, osloTodayISODate } from "@/lib/date/oslo";

/**
 * Grunnform for alle order-responser
 */
export type OrderApiBase = {
  ok: boolean;
  rid: string;

  // Dato
  date: string;    // YYYY-MM-DD (intern)
  dateNO: string;  // DD-MM-YYYY (UI)

  // Tilstand
  locked: boolean;
  cutoffTime: string; // "08:00"
  menuAvailable: boolean;
  canAct: boolean;

  // Feil
  error: string | null;
  message: string | null;

  // Data
  receipt: any | null;
  order: any | null;
};

/**
 * Standard response-builder
 */
export function orderBase(params: {
  ok: boolean;
  rid: string;

  date?: string;
  locked: boolean;
  cutoffTime?: string | null;
  menuAvailable: boolean;
  canAct: boolean;

  error?: string | null;
  message?: string | null;

  receipt?: any | null;
  order?: any | null;
}): OrderApiBase {
  const date = params.date ?? osloTodayISODate();
  const cutoffTime = params.cutoffTime ?? "08:00";

  return {
    ok: params.ok,
    rid: params.rid,

    date,
    dateNO: formatDateNO(date),

    locked: params.locked,
    cutoffTime,
    menuAvailable: params.menuAvailable,
    canAct: params.canAct,

    error: params.error ?? null,
    message: params.message ?? null,

    receipt: params.receipt ?? null,
    order: params.order ?? null,
  };
}

/**
 * Standard kvittering (receipt)
 * Brukes på success + idempotent success
 */
export function receiptFor(
  orderId: string | null,
  status: string,
  timestamp?: string
) {
  return {
    orderId,
    status,
    timestamp: timestamp ?? nowISO(), // UTC ISO
  };
}
