// lib/server/employee/fetchOrderWindowServerSide.ts — server fetch av GET /api/order/window (cookies), én sannhetskilde som /week/min-dag
import "server-only";

import { cookies, headers } from "next/headers";

export type OrderWindowDay = {
  date?: unknown;
  weekday?: unknown;
  isLocked?: unknown;
  isEnabled?: unknown;
  lockReason?: unknown;
  wantsLunch?: unknown;
  orderStatus?: unknown;
  lastSavedAt?: unknown;
};

export type OrderWindowData = {
  ok?: unknown;
  days?: unknown;
  company?: { name?: unknown };
  agreement?: { message?: unknown; status?: unknown };
  serverOsloDate?: unknown;
  todayCutoffStatus?: unknown;
  weekOrderingAllowed?: unknown;
  message?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type FetchOrderWindowResult =
  | { ok: true; data: OrderWindowData }
  | { ok: false; message: string };

/**
 * Samme mønster som employee «Min dag»: intern fetch med brukerens cookies.
 * `weeks`: 1 eller 2 (API-standard: 2 gir inntil to uker når neste uke er synlig).
 */
export async function fetchOrderWindowServerSide(opts?: {
  weeks?: 1 | 2;
  ridPrefix?: string;
}): Promise<FetchOrderWindowResult> {
  const weeks = opts?.weeks === 1 ? 1 : 2;
  const ridPrefix = opts?.ridPrefix ?? "order_window";

  const headersList = await headers();
  const host = safeStr(headersList.get("x-forwarded-host")) || safeStr(headersList.get("host")) || "localhost:3000";
  const proto = safeStr(headersList.get("x-forwarded-proto")) || "http";

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const url = `${proto}://${host}/api/order/window?weeks=${weeks}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
      "x-rid": `${ridPrefix}_${Date.now().toString(36)}`,
    },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, message: "Kunne ikke lese svar fra bestillingssystemet." };
  }

  const wrap = body as { ok?: unknown; data?: unknown; message?: unknown };
  if (!res.ok || wrap.ok !== true) {
    const msg = safeStr(wrap.message) || `Feil (${res.status})`;
    return { ok: false, message: msg };
  }

  return { ok: true, data: (wrap.data ?? {}) as OrderWindowData };
}
