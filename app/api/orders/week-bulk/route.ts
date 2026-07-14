// app/api/orders/week-bulk/route.ts
//
// FASE 6 — canonical WEEKLY bulk ordering.
//
// Golden Path law: every day is written through the ONE canonical order engine
// (POST /api/orders → lp_order_set). This route contains ZERO order logic of
// its own — it delegates each day to the canonical handler with a per-day
// Idempotency-Key. That makes the bulk operation ATOMIC PER SELECTED ACTION
// (each day's SET/CANCEL is one atomic lp_order_set transaction); one failing
// day never rolls back or blocks the others, and results are reported per day.
//
// Deprecated split-brain routes (bulk-set/day_choices writers) are NOT revived:
// no direct table writes happen here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import crypto from "node:crypto";
import { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { POST as canonicalOrderPOST } from "@/app/api/orders/route";

const MAX_DAYS = 7;

type BulkDayInput = {
  date: string;
  action: "set" | "cancel";
  choice_key?: string | null;
  item_key?: string | null;
};

type BulkDayResult = {
  date: string;
  action: "set" | "cancel";
  ok: boolean;
  httpStatus: number;
  code: string | null;
  orderId: string | null;
  status: string | null;
  message: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function parseDays(body: unknown): { ok: true; days: BulkDayInput[] } | { ok: false; message: string } {
  const raw = (body as { days?: unknown } | null)?.days;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, message: "days må være en liste med 1–7 dager." };
  if (raw.length > MAX_DAYS) return { ok: false, message: `Maks ${MAX_DAYS} dager per bulk-operasjon.` };

  const days: BulkDayInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const date = safeStr(e.date);
    const action = safeStr(e.action).toLowerCase();
    if (!isIsoDate(date)) return { ok: false, message: `Ugyldig dato: ${date || "(tom)"}.` };
    if (action !== "set" && action !== "cancel") return { ok: false, message: `Ugyldig handling for ${date}.` };
    if (seen.has(date)) return { ok: false, message: `Duplisert dato: ${date}.` };
    seen.add(date);
    days.push({
      date,
      action: action as "set" | "cancel",
      choice_key: safeStr(e.choice_key ?? e.choiceKey) || null,
      item_key: safeStr(e.item_key ?? e.itemKey) || null,
    });
  }
  return { ok: true, days };
}

/** Forward auth-relevant headers to the delegated canonical request. */
function delegatedHeaders(req: NextRequest, idemKey: string, rid: string): Headers {
  const h = new Headers();
  for (const name of ["cookie", "authorization", "x-forwarded-for", "user-agent"]) {
    const v = req.headers.get(name);
    if (v) h.set(name, v);
  }
  h.set("content-type", "application/json");
  h.set("Idempotency-Key", idemKey);
  h.set("x-rid", rid);
  return h;
}

export async function POST(req: NextRequest) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.res ?? g.response;

  const deny = requireRoleOr403(g.ctx, "orders.week_bulk", ["employee", "company_admin"]);
  if (deny) return deny;

  const rid = req.headers.get("x-rid")?.trim() || g.ctx.rid || makeRid("rid_week_bulk");

  const body = await readJson(req);
  const parsed = parseDays(body);
  if (parsed.ok === false) {
    return jsonErr(rid, parsed.message, 422, "BULK_VALIDATION_FAILED");
  }

  // Per-day idempotency: stable bulk key (client-supplied or generated) + date
  // + action. Retry/double-click replays the SAME canonical per-day keys.
  const bulkKeyRaw = safeStr(req.headers.get("Idempotency-Key"));
  const bulkKey = bulkKeyRaw.length >= 8 ? bulkKeyRaw : crypto.randomUUID();

  const results: BulkDayResult[] = [];
  for (const day of parsed.days) {
    const dayIdemKey = `${bulkKey}:${day.date}:${day.action}`;
    const dayRid = `${rid}_${day.date.replace(/-/g, "")}`;
    const delegated = new NextRequest("http://internal.lunchportalen.local/api/orders", {
      method: "POST",
      headers: delegatedHeaders(req, dayIdemKey, dayRid),
      body: JSON.stringify({
        date: day.date,
        action: day.action,
        ...(day.action === "set" && day.choice_key ? { choice_key: day.choice_key } : {}),
        ...(day.action === "set" && day.item_key ? { itemKey: day.item_key } : {}),
      }),
    });

    let res: Response;
    try {
      res = await canonicalOrderPOST(delegated);
    } catch {
      results.push({
        date: day.date,
        action: day.action,
        ok: false,
        httpStatus: 500,
        code: "ORDER_SET_FAILED",
        orderId: null,
        status: null,
        message: "Vi kunne ikke lagre bestillingen nå.",
      });
      continue;
    }

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const ok = res.ok && json?.ok === true;
    results.push({
      date: day.date,
      action: day.action,
      ok,
      httpStatus: res.status,
      code: ok ? null : safeStr(json?.error ?? (json?.code as string)) || null,
      orderId: safeStr(json?.orderId) || null,
      status: safeStr(json?.status) || null,
      message: ok ? null : safeStr(json?.message) || null,
    });
  }

  const succeeded = results.filter((r) => r.ok).length;
  return jsonOk(
    rid,
    {
      results,
      summary: { requested: results.length, succeeded, failed: results.length - succeeded },
      bulkKey,
    },
    200,
  );
}
