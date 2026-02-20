// app/api/orders/choice/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonOk } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";
import { requireRule } from "@/lib/agreement/requireRule";
import { lpOrderSet } from "@/lib/orders/rpcWrite";

/* =========================================================
   Route-local jsonErr (beholder canAct:false for UI)
========================================================= */
function jsonErr(rid: string, message: string, status = 400, error?: unknown) {
  let errorVal: unknown = "ERROR";
  let detail: unknown = undefined;

  if (error !== undefined) {
    if (typeof error === "object" && error && "code" in (error as any)) {
      const code = (error as any).code;
      errorVal = typeof code === "string" ? code : "ERROR";
      if ("detail" in (error as any)) detail = (error as any).detail;
    } else if (typeof error === "string") {
      errorVal = error;
    } else if (error instanceof Error) {
      errorVal = error.message || "ERROR";
    } else {
      errorVal = error;
    }
  }

  const body: any = { ok: false, rid, error: errorVal, message, status, canAct: false };
  if (detail !== undefined) body.detail = detail;

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

/* =========================================================
   Helpers
========================================================= */

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeScope(scope: any) {
  const sc: any = scope ?? {};
  return {
    userId: String(sc.user_id ?? sc.userId ?? sc.userID ?? "").trim(),
    email: sc.email ?? null,
    companyId: String(sc.company_id ?? sc.companyId ?? sc.companyID ?? "").trim(),
    locationId: String(sc.location_id ?? sc.locationId ?? sc.locationID ?? "").trim(),
    role: String(sc.role ?? "").trim(),
  };
}

function weekdayKeyOslo(isoDate: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
      Mon: "mon",
      Tue: "tue",
      Wed: "wed",
      Thu: "thu",
      Fri: "fri",
    };
    return map[wd] ?? null;
  } catch {
    return null;
  }
}

function normalizeChoiceKey(choiceKey: string) {
  const raw = String(choiceKey || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.startsWith("choice:")) return lower.slice("choice:".length).trim();
  return lower;
}

/**
 * NOTE storage (BACKWARDS COMPAT + VARIANT SUPPORT)
 *
 * Old behaviour: note == "<choice_key>"
 * New behaviour: note == "<choice_key>||<human_note>"
 *
 * - The first segment is ALWAYS the system-stable choice key.
 * - The suffix is optional and can be a human-readable variant (e.g. "Påsmurt: Vegan").
 * - If client does not send note:
 *    - preserve suffix only when choice key stays the same
 *    - otherwise clear suffix (avoid stale variant)
 */

const NOTE_SEP = "||";

function splitNote(note: string | null | undefined): { choiceKey: string; suffix: string | null } {
  const n = String(note ?? "").trim();
  if (!n) return { choiceKey: "", suffix: null };
  const idx = n.indexOf(NOTE_SEP);
  if (idx === -1) return { choiceKey: n, suffix: null };
  const head = n.slice(0, idx).trim();
  const tail = n.slice(idx + NOTE_SEP.length).trim();
  return { choiceKey: head, suffix: tail.length ? tail : null };
}

function sanitizeSuffix(s: string) {
  // Avoid separator injection, cap length (UI/kitchen safe)
  const trimmed = String(s ?? "").trim();
  if (!trimmed) return null;
  const cleaned = trimmed.split(NOTE_SEP).join(" ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 180 ? cleaned.slice(0, 180).trim() : cleaned;
}

function composeNote(choiceKey: string, suffix: string | null) {
  const ck = normalizeChoiceKey(choiceKey);
  const sf = sanitizeSuffix(suffix ?? "");
  return sf ? `${ck}${NOTE_SEP}${sf}` : ck;
}

function setChoiceInNote(existingNote: string | null | undefined, nextChoiceKey: string, clientNote: string | null) {
  const existing = splitNote(existingNote);

  // If client sends note, it wins as suffix (but we ALWAYS keep choiceKey first)
  const clientSuffix = sanitizeSuffix(clientNote ?? "");
  if (clientSuffix) return composeNote(nextChoiceKey, clientSuffix);

  // If no client note: preserve suffix only if same choiceKey
  const prevChoice = normalizeChoiceKey(existing.choiceKey);
  const nextChoice = normalizeChoiceKey(nextChoiceKey);
  if (prevChoice && prevChoice === nextChoice && existing.suffix) {
    return composeNote(nextChoiceKey, existing.suffix);
  }

  // Otherwise: just choice key (no stale suffix)
  return composeNote(nextChoiceKey, null);
}

function eventKeyForChoice(input: {
  companyId: string;
  locationId: string;
  userId: string;
  date: string;
  choiceKey: string;
  clientRequestId?: string | null;
}) {
  const cr = safeStr(input.clientRequestId);
  if (cr) return `choice:${input.companyId}:${input.locationId}:${input.userId}:${input.date}:${cr}`;
  return `choice:${input.companyId}:${input.locationId}:${input.userId}:${input.date}:${input.choiceKey}`;
}

/* =========================================================
   Types
========================================================= */

type CompanyRow = {
  id: string;
  status: string | null;
};

type OrderRow = {
  id: string;
  date: string;
  status: string | null; // active | canceled
  note: string | null;
  slot: string | null;
  user_id: string;
  company_id: string | null;
  location_id: string | null;
};

type UpdatedRow = {
  id: string;
  date: string;
  status: string | null;
  note: string | null;
  slot: string | null;
  updated_at: string | null;
  created_at: string | null;
};

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");

  // ✅ scope gate
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const ctx = a.ctx;
  const { rid } = ctx;

  // ✅ role gate
  const denyRole = requireRoleOr403(ctx, "orders.choice", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  // ✅ normalize scope ONCE
  const norm = normalizeScope(ctx.scope);
  if (!norm.userId || !norm.companyId || !norm.locationId) {
    return jsonErr(rid, "Mangler firmatilknytning (company/location).", 403, "missing_scope");
  }

  // ✅ service role admin for company-status + rules
  let admin: any = null;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    admin = supabaseAdmin();
  } catch {
    return jsonErr(rid, "Mangler service role konfigurasjon for avtalerregler.", 500, "CONFIG_ERROR");
  }

  const sb = await supabaseServer();

  // Body
  const body = await readJson(req);

  const date = safeText(body?.date);
  const choice_key_raw = safeText(body?.choice_key);
  const client_request_id = safeText(body?.client_request_id);

  // ✅ NEW: optional note (variant)
  const client_note_raw = safeText(body?.note); // may be null
  const client_note = client_note_raw ? sanitizeSuffix(client_note_raw) : null;

  if (!date || !isIsoDate(date)) return jsonErr(rid, "Ugyldig dato.", 400, { code: "bad_date", detail: { date } });
  if (!choice_key_raw)
    return jsonErr(rid, "Mangler choice_key.", 400, { code: "bad_choice", detail: { choice_key: choice_key_raw } });

  const choice_key = normalizeChoiceKey(choice_key_raw);
  if (!choice_key)
    return jsonErr(rid, "Ugyldig choice_key.", 400, { code: "bad_choice", detail: { choice_key: choice_key_raw } });

  // Cutoff / past-lock
  const cutoff = cutoffStatusForDate(date);
  if (cutoff === "PAST") {
    return jsonErr(rid, "Datoen er passert og kan ikke endres.", 403, { code: "DATE_LOCKED_PAST", detail: { date } });
  }
  if (cutoff === "TODAY_LOCKED") {
    return jsonErr(rid, "Endringer er låst etter kl. 08:00 i dag.", 409, {
      code: "LOCKED_AFTER_0800",
      detail: { date, cutoff: "08:00" },
    });
  }

  // Company status gate
  const { data: company, error: cErr } = (await admin
    .from("companies")
    .select("id,status")
    .eq("id", norm.companyId)
    .maybeSingle()) as { data: CompanyRow | null; error: any };

  if (cErr) return jsonErr(rid, "Kunne ikke hente firmastatus.", 500, { code: "db_company", detail: { message: cErr.message } });
  if (!company) return jsonErr(rid, "Firma finnes ikke.", 403, { code: "forbidden", detail: { companyId: norm.companyId } });

  const companyStatus = String(company.status ?? "").toLowerCase().trim();
  if (companyStatus && companyStatus !== "active") {
    return jsonErr(rid, "Firma er ikke aktivt.", 403, { code: "company_blocked", detail: { companyStatus } });
  }

  // Agreement rule gate — ✅ FAIL SOFT (only hard-stop on explicit FORBIDDEN/403)
  const dayKey = weekdayKeyOslo(date);
  if (!dayKey) return jsonErr(rid, "Ugyldig ukedag.", 400, { code: "bad_date", detail: { date } });

  try {
    const ruleRes = await requireRule({ sb: admin as any, companyId: norm.companyId, dayKey, slot: "lunch", rid });

    // If rule explicitly forbids, stop. Otherwise ignore errors.
    if (ruleRes && (ruleRes as any).ok === false && Number((ruleRes as any).status) === 403) {
      const err = ruleRes as { status: number; error: string; message: string };
      return jsonErr(rid, err.message, err.status, err.error);
    }
  } catch {
    // ignore (fail-soft)
  }

  // ✅ Find current order (tenant-safe)
  const { data: order, error: ordErr } = (await sb
    .from("orders")
    .select("id,date,status,note,slot,user_id,company_id,location_id")
    .eq("user_id", norm.userId)
    .eq("company_id", norm.companyId)
    .eq("location_id", norm.locationId)
    .eq("date", date)
    .eq("slot", "lunch")
    .maybeSingle()) as { data: OrderRow | null; error: any };

  if (ordErr) return jsonErr(rid, "Kunne ikke hente bestilling.", 500, { code: "db_order", detail: { message: ordErr.message } });

  const savedAt = nowIso();

  // ✅ NOTE: keep choice key first, optionally store variant suffix
  const nextNote = setChoiceInNote(order?.note ?? null, choice_key, client_note);

  const setRes = await lpOrderSet(sb as any, {
    p_date: date,
    p_slot: "lunch",
    p_note: nextNote,
  });

  if (!setRes.ok) {
    return jsonErr(rid, "Kunne ikke aktivere bestilling.", 500, {
      code: setRes.code ?? "ORDER_RPC_FAILED",
      detail: { message: setRes.error?.message ?? "rpc_failed" },
    });
  }

  const { data: updated, error: updErr } = (await sb
    .from("orders")
    .select("id,date,status,note,slot,updated_at,created_at")
    .eq("user_id", norm.userId)
    .eq("company_id", norm.companyId)
    .eq("location_id", norm.locationId)
    .eq("date", date)
    .eq("slot", "lunch")
    .maybeSingle()) as { data: UpdatedRow | null; error: any };

  if (updErr || !updated) {
    return jsonErr(rid, "Kunne ikke lese bestilling etter lagring.", 500, {
      code: "ORDER_READ_FAILED",
      detail: { message: updErr?.message ?? "read_failed" },
    });
  }

  const orderId = updated.id;

  // Backup (best effort)

  return jsonOk(rid, {
    changed: true,
    canAct: true,
    order: {
      id: updated.id,
      date: updated.date,
      status: String(updated.status ?? "").toUpperCase(),
      note: updated.note,
      slot: updated.slot ?? "lunch",
      updated_at: updated.updated_at,
      saved_at: savedAt,
      created_at: updated.created_at,
    },
  });
}




