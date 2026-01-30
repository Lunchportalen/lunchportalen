// lib/orders/result.ts
export type OrderStatus =
  | "registered"
  | "cancelled"
  | "too_late"
  | "closed_date"
  | "company_paused";

export type OrderAction = "register" | "cancel";

export type OrderOk = {
  ok: true;
  rid: string;
  action: OrderAction;
  status: OrderStatus;

  orderId: string | null;

  date: string; // YYYY-MM-DD
  slot: string; // e.g. "lunch"
  note: string | null;

  serverTime: string; // ISO timestamp
};

export type OrderErrCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL";

export type OrderErr = {
  ok: false;
  rid: string;
  error: OrderErrCode;
  message: string;
  detail?: unknown;
};

export type OrderResult = OrderOk | OrderErr;

/* =========================
   Helpers
========================= */

export function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export function normSlot(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s.toLowerCase() : "lunch";
}

export function safeNote(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export function okOrder(input: Omit<OrderOk, "ok" | "serverTime">): OrderOk {
  return {
    ok: true,
    serverTime: new Date().toISOString(),
    ...input,
  };
}

export function errOrder(
  rid: string,
  error: OrderErrCode,
  message: string,
  detail?: unknown
): OrderErr {
  const e: OrderErr = { ok: false, rid, error, message };
  if (typeof detail !== "undefined") e.detail = detail;
  return e;
}

export function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  } as const;
}

/**
 * Oslo "now" uten eksterne libs.
 * Gir { isoDate: YYYY-MM-DD, hhmm: "HH:MM" } i Europe/Oslo.
 */
export function osloNowParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const isoDate = `${get("year")}-${get("month")}-${get("day")}`;
  const hhmm = `${get("hour")}:${get("minute")}`;
  return { isoDate, hhmm };
}

/** true hvis Oslo-klokka er >= 08:00 */
export function isAfterCutoff0800Oslo() {
  const { hhmm } = osloNowParts();
  // "HH:MM" string compare funker når begge er 2-sifret
  return hhmm >= "08:00";
}
