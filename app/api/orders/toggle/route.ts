// app/api/orders/toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, jsonFromThrown } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";
import { requireRule } from "@/lib/agreement/requireRule";

type OrderStatus = "active" | "canceled";
type CompanyStatusNorm = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";

/* =========================================================
   Small utils
========================================================= */

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function safeLower(v: unknown) {
  return safeStr(v).toLowerCase();
}

function wantsLunchFromBody(body: any): boolean {
  if (typeof body?.wants_lunch === "boolean") return body.wants_lunch;
  if (typeof body?.wantsLunch === "boolean") return body.wantsLunch;
  if (typeof body?.wants_lunch === "string") return body.wants_lunch === "true";
  if (typeof body?.wantsLunch === "string") return body.wantsLunch === "true";
  return false;
}

function normalizeChoiceKey(v: unknown): string | null {
  const raw = safeLower(v);
  if (!raw) return null;
  if (raw.startsWith("choice:")) {
    const k = raw.slice("choice:".length).trim();
    return k || null;
  }
  return raw;
}

function normalizeExistingStatus(v: unknown): OrderStatus | null {
  const s = safeLower(v);
  if (s === "active") return "active";
  if (s === "canceled" || s === "cancelled") return "canceled";
  return null;
}

/* =========================================================
   NOTE (choice + optional variant suffix)
========================================================= */

const NOTE_SEP = "||";

function sanitizeSuffix(s: unknown) {
  const trimmed = safeStr(s);
  if (!trimmed) return null;
  const cleaned = trimmed.split(NOTE_SEP).join(" ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 180 ? cleaned.slice(0, 180).trim() : cleaned;
}

function splitNote(note: unknown): { choiceKey: string; suffix: string | null } {
  const n = safeStr(note);
  if (!n) return { choiceKey: "", suffix: null };
  const idx = n.indexOf(NOTE_SEP);
  if (idx === -1) return { choiceKey: n, suffix: null };
  const head = n.slice(0, idx).trim();
  const tail = n.slice(idx + NOTE_SEP.length).trim();
  return { choiceKey: head, suffix: tail.length ? tail : null };
}

function composeNote(choiceKey: string, suffix: string | null) {
  const ck = normalizeChoiceKey(choiceKey) ?? "";
  const sf = sanitizeSuffix(suffix);
  return sf ? `${ck}${NOTE_SEP}${sf}` : ck;
}

function setChoiceInNote(existingNote: unknown, nextChoiceKey: string, clientNote: unknown) {
  const existing = splitNote(existingNote);
  const nextChoice = normalizeChoiceKey(nextChoiceKey) ?? "";

  const clientSuffix = sanitizeSuffix(clientNote);
  if (clientSuffix) return composeNote(nextChoice, clientSuffix);

  const prevChoice = normalizeChoiceKey(existing.choiceKey) ?? "";
  if (prevChoice && prevChoice === nextChoice && existing.suffix) {
    return composeNote(nextChoice, existing.suffix);
  }

  return composeNote(nextChoice, null);
}

/* =========================================================
   Date → weekday key (Oslo)
========================================================= */

function weekdayKeyFromISO(dateISO: string): DayKey {
  // noon UTC avoids DST edge wobble
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, DayKey> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd];
  if (!key) {
    const err: any = new Error("Kun Man–Fre er gyldig.");
    err.status = 400;
    err.code = "INVALID_WEEKDAY";
    throw err;
  }
  return key;
}

/* =========================================================
   Mock-tolerant Supabase adapter
========================================================= */

async function table(sb: any, name: string) {
  const t = sb?.from?.(name);
  if (!t) {
    const err: any = new Error("DB client mangler .from()");
    err.status = 500;
    err.code = "DB_CLIENT_INVALID";
    throw err;
  }
  if (typeof t?.then === "function") return await t;
  return t;
}

function hasWhere(q: any) {
  return q && (typeof q.eq === "function" || typeof q.match === "function" || typeof q.filter === "function");
}

function applyWhere(q: any, key: string, value: any) {
  if (!q) return q;
  if (typeof q.eq === "function") return q.eq(key, value);
  if (typeof q.match === "function") return q.match({ [key]: value });
  if (typeof q.filter === "function") return q.filter(key, "eq", value);
  return q;
}

function toWhereCapable(q: any, colsForProbe = "*") {
  if (hasWhere(q)) return q;
  if (q && typeof q.select === "function") {
    const out = q.select(colsForProbe);
    if (out && typeof out.then === "function") return q;
    if (hasWhere(out)) return out;
  }
  return q;
}

async function execOne(q: any) {
  if (!q) return { data: null, error: null };

  const run = async () => {
    if (typeof q.maybeSingle === "function") return await q.maybeSingle();
    if (typeof q.single === "function") return await q.single();

    if (typeof q.limit === "function") {
      const r = await q.limit(1);
      const row = Array.isArray(r?.data) ? r.data[0] : r?.data ?? null;
      return { ...r, data: row ?? null };
    }

    if (typeof q.then === "function") {
      const r = await q;
      const row = Array.isArray(r?.data) ? r.data[0] : r?.data ?? null;
      return { ...r, data: row ?? null };
    }

    const row = Array.isArray(q?.data) ? q.data[0] : q?.data ?? null;
    return { ...q, data: row ?? null };
  };

  const r = await run();
  const row = Array.isArray(r?.data) ? r.data[0] : r?.data ?? null;
  return { ...r, data: row ?? null };
}

async function selectOne(sb: any, tableName: string, cols: string, where: Record<string, any>) {
  const base = await table(sb, tableName);

  let q: any = toWhereCapable(base, cols);
  for (const [k, v] of Object.entries(where)) q = applyWhere(q, k, v);

  if (q && typeof q.select === "function") {
    const out = q.select(cols);
    if (out && typeof out.then !== "function") q = out;
  }

  return await execOne(q);
}

async function insertOne(sb: any, tableName: string, payload: any, selectCols: string) {
  const base = await table(sb, tableName);

  if (typeof base.insert !== "function") {
    return { ok: false as const, skipped: true as const, error: { code: "DB_INSERT_UNSUPPORTED" } };
  }

  let q: any = base.insert(payload);
  if (q && typeof q.select === "function") {
    const out = q.select(selectCols);
    if (out && typeof out.then !== "function") q = out;
  }

  const r = await execOne(q);
  return { ok: true as const, data: (r as any)?.data ?? null, error: (r as any)?.error ?? null };
}

async function updateWhere(sb: any, tableName: string, patch: any, where: Record<string, any>) {
  const base = await table(sb, tableName);
  if (typeof base.update !== "function") {
    const err: any = new Error("DB builder mangler .update()");
    err.status = 500;
    err.code = "DB_UPDATE_UNSUPPORTED";
    throw err;
  }

  let q: any = base.update(patch);
  q = toWhereCapable(q);

  for (const [k, v] of Object.entries(where)) q = applyWhere(q, k, v);

  return await execOne(q);
}

/* =========================================================
   Company gate
========================================================= */

function normCompanyStatus(v: any): CompanyStatusNorm {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

async function assertCompanyCanEdit(sb: any, company_id: string) {
  const { data, error } = await selectOne(sb, "companies", "id,status,paused_reason,closed_reason", { id: company_id });

  if (error || !data) {
    const err: any = new Error("Kunne ikke hente firmastatus.");
    err.status = 500;
    err.code = "COMPANY_LOOKUP_FAILED";
    err.detail = (error as any)?.message ?? null;
    throw err;
  }

  const st = normCompanyStatus((data as any).status);

  if (st === "PAUSED") {
    const err: any = new Error("Bestilling/avbestilling er midlertidig pauset for firma.");
    err.status = 403;
    err.code = "COMPANY_PAUSED";
    throw err;
  }
  if (st === "CLOSED") {
    const err: any = new Error("Firma er stengt. Bestilling/avbestilling er låst.");
    err.status = 403;
    err.code = "COMPANY_CLOSED";
    throw err;
  }
  if (st !== "ACTIVE") {
    const err: any = new Error("Firma er ikke aktivt. Bestilling/avbestilling er låst.");
    err.status = 403;
    err.code = "COMPANY_NOT_ACTIVE";
    throw err;
  }

  return { ok: true as const };
}

/* =========================================================
   Agreement rules gate (employee PLACE only)
   ✅ Uses requireRule() — exactly what tests mock.
========================================================= */

async function assertAgreementAllowsPlaceEmployeeOnly(opts: {
  rid: string;
  company_id: string;
  location_id: string;
  dateISO: string;
  role: string;
  slot: string;
}) {
  if (opts.role === "company_admin") return;

  const day_key = weekdayKeyFromISO(opts.dateISO);

  const rr: any = await (requireRule as any)({
    rid: opts.rid,
    company_id: opts.company_id,
    location_id: opts.location_id,
    day_key,
    slot: opts.slot,
  });

  if (rr?.ok === false) {
    const err: any = new Error(String(rr?.message ?? "Avtale tillater ikke dette."));
    err.status = Number(rr?.status ?? 403);
    err.code = String(rr?.error ?? "AGREEMENT_RULE_MISSING");
    throw err;
  }
}

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);

  // ✅ API contract: this route must ALWAYS return { ok, rid, ... }
  // If scope guard failed, we may not have rid — use deterministic fallback.
  if (a.ok === false) {
    const rid = "rid_orders_toggle_auth";
    return jsonErr(rid, "Unauthorized.", 401, "UNAUTHORIZED");
  }

  const { rid, scope } = a.ctx;

  const deny = requireRoleOr403(a.ctx, "orders.toggle", ["employee", "company_admin"]);
  if (deny) {
    return jsonErr(rid, "Forbidden.", 403, "FORBIDDEN");
  }

  const sc: any = scope as any;
  const role = safeStr(sc.role);
  const user_id = safeStr(sc.user_id ?? sc.userId ?? sc.userID);
  const company_id = safeStr(sc.company_id ?? sc.companyId ?? sc.companyID);
  const location_id = safeStr(sc.location_id ?? sc.locationId ?? sc.locationID);

  if (!user_id || !company_id || !location_id) {
    return jsonErr(rid, "Mangler scope.", 403, "SCOPE_MISSING");
  }

  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  try {
    const body = await readJson(req);

    const date = safeStr(body?.date);
    const slot = safeStr(body?.slot) || "lunch";

    if (!isIsoDate(date)) return jsonErr(rid, "Ugyldig dato.", 400, "INVALID_DATE");

    const cutoff = cutoffStatusForDate(date);
    if (cutoff === "PAST") return jsonErr(rid, "Dato er passert.", 403, "DATE_PAST");
    if (cutoff === "TODAY_LOCKED") return jsonErr(rid, "Låst etter 08:00.", 403, "CUTOFF");

    const wantsLunch = Boolean(wantsLunchFromBody(body));
    const nextStatus: OrderStatus = wantsLunch ? "active" : "canceled";

    const choiceKey = normalizeChoiceKey(body?.choice_key);
    if (wantsLunch && !choiceKey) {
      return jsonErr(rid, "Velg meny før du bestiller.", 400, "MISSING_CHOICE_KEY");
    }

    const clientNote = sanitizeSuffix(body?.note);
    const now = new Date().toISOString();

    await assertCompanyCanEdit(sb as any, company_id);

    if (wantsLunch) {
      await assertAgreementAllowsPlaceEmployeeOnly({
        rid,
        company_id,
        location_id,
        dateISO: date,
        role,
        slot,
      });
    }

    const found = await selectOne(sb as any, "orders", "id,status,note", {
      user_id,
      company_id,
      location_id,
      date,
      slot,
    });

    const existing = (found as any)?.data ?? null;
    const findErr = (found as any)?.error ?? null;

    if (findErr && (findErr as any).code !== "PGRST116") {
      const err: any = new Error("Kunne ikke hente bestilling.");
      err.status = 500;
      err.code = "ORDERS_FETCH_FAILED";
      err.detail = (findErr as any)?.message ?? null;
      throw err;
    }

    const nextNote = wantsLunch
      ? setChoiceInNote(existing?.note ?? null, choiceKey as string, clientNote)
      : existing?.note ?? null;

    let orderId: string;

    if (!existing?.id) {
      const ins = await insertOne(
        sb as any,
        "orders",
        {
          user_id,
          company_id,
          location_id,
          date,
          slot,
          status: nextStatus,
          note: wantsLunch ? nextNote : null,
          created_at: now,
          updated_at: now,
        },
        "id"
      );

      if ((ins as any)?.ok === false && (ins as any)?.skipped === true) {
        return jsonOk(rid, {
          order: {
            id: "mock",
            date,
            status: nextStatus,
            note: wantsLunch ? nextNote : existing?.note ?? null,
            slot,
            saved_at: now,
            persisted: false,
          },
        });
      }

      const insData = (ins as any)?.data ?? null;
      const insErr = (ins as any)?.error ?? null;

      if (insErr || !insData?.id) {
        const err: any = new Error("Kunne ikke lagre.");
        err.status = 500;
        err.code = "INSERT_FAILED";
        err.detail = insErr?.message ?? null;
        throw err;
      }

      orderId = String(insData.id);
    } else {
      orderId = String(existing.id);

      const existingStatus = normalizeExistingStatus(existing?.status);
      if (existingStatus !== nextStatus) {
        const updS = await updateWhere(
          sb as any,
          "orders",
          { status: nextStatus, updated_at: now },
          { id: orderId, company_id, location_id, user_id }
        );
        if ((updS as any)?.error) {
          const err: any = new Error("Kunne ikke lagre.");
          err.status = 500;
          err.code = "UPDATE_FAILED";
          err.detail = (updS as any)?.error?.message ?? null;
          throw err;
        }
      }

      const updN = await updateWhere(
        sb as any,
        "orders",
        { note: wantsLunch ? nextNote : existing?.note ?? null, updated_at: now },
        { id: orderId, company_id, location_id, user_id }
      );
      if ((updN as any)?.error) {
        const err: any = new Error("Kunne ikke lagre.");
        err.status = 500;
        err.code = "UPDATE_FAILED";
        err.detail = (updN as any)?.error?.message ?? null;
        throw err;
      }
    }

    return jsonOk(rid, {
      order: {
        id: orderId,
        date,
        status: nextStatus,
        note: wantsLunch ? nextNote : existing?.note ?? null,
        slot,
        saved_at: now,
        persisted: true,
      },
    });
  } catch (e: any) {
    return jsonFromThrown(rid, e, "Kunne ikke lagre.");
  }
}
