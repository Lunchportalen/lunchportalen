// app/api/orders/toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";

/**
 * Toggle order ACTIVE/CANCELLED for a given date.
 * Enterprise rules:
 * - Tenant-safe (user + company + location + date + slot)
 * - Cutoff enforced (08:00 Oslo)
 * - wants_lunch=true requires choice_key
 * - NOTE storage supports variants without breaking legacy:
 *     note = "<choice_key>||<human_suffix>"   (suffix optional)
 *   Legacy readers can still take the first segment as choice key.
 */

type OrderStatus = "active" | "canceled";

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

// Accepts "varmmat" or "choice:varmmat"
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

  // If client provides note -> use as suffix
  const clientSuffix = sanitizeSuffix(clientNote);
  if (clientSuffix) return composeNote(nextChoice, clientSuffix);

  // Otherwise: preserve suffix ONLY if choice key stays same (avoid stale variants)
  const prevChoice = normalizeChoiceKey(existing.choiceKey) ?? "";
  if (prevChoice && prevChoice === nextChoice && existing.suffix) {
    return composeNote(nextChoice, existing.suffix);
  }

  return composeNote(nextChoice, null);
}

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const deny = requireRoleOr403(a.ctx, "orders.toggle", ["employee", "company_admin"]);
  if (deny) return deny;

  const sc: any = scope as any;
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
    const slot = "lunch";

    if (!isIsoDate(date)) return jsonErr(rid, "Ugyldig dato.", 400, "INVALID_DATE");

    const cutoff = cutoffStatusForDate(date);
    if (cutoff === "PAST") return jsonErr(rid, "Dato er passert.", 403, "DATE_PAST");
    if (cutoff === "TODAY_LOCKED") return jsonErr(rid, "Låst etter 08:00.", 403, "CUTOFF");

    const wantsLunch = Boolean(wantsLunchFromBody(body));
    const nextStatus: OrderStatus = wantsLunch ? "active" : "canceled";

    const choiceKey = normalizeChoiceKey(body?.choice_key);

    // ✅ HARD RULE: if wants_lunch=true then choice_key must be present
    if (wantsLunch && !choiceKey) {
      return jsonErr(rid, "Velg meny før du bestiller.", 400, "MISSING_CHOICE_KEY");
    }

    // ✅ Optional variant note from client (e.g. "Påsmurt: Vegan")
    const clientNote = sanitizeSuffix(body?.note);

    const now = new Date().toISOString();

    // ✅ Tenant-safe lookup
    const { data: existing, error: findErr } = await sb
      .from("orders")
      .select("id,status,note")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .eq("date", date)
      .eq("slot", slot)
      .maybeSingle();

    if (findErr && (findErr as any).code !== "PGRST116") throw findErr;

    let orderId: string;

    // Determine next note:
    // - if wantsLunch: store choice key (+ optional suffix)
    // - if cancel: keep note as-is? We choose to KEEP note for history (safe), but you can null it if you want.
    //   (Keeping is useful for audit/kitchen; status determines active anyway.)
    const nextNote = wantsLunch
      ? setChoiceInNote((existing as any)?.note ?? null, choiceKey as string, clientNote)
      : ((existing as any)?.note ?? null);

    if (!existing?.id) {
      // Create
      const ins = await sb
        .from("orders")
        .insert({
          user_id,
          company_id,
          location_id,
          date,
          slot,
          status: nextStatus,
          note: wantsLunch ? nextNote : null, // if cancelling a non-existent order, no need to create canceled record with note
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .maybeSingle();

      if (ins.error || !ins.data?.id) throw ins.error ?? new Error("Insert failed");
      orderId = ins.data.id;

      const rpc = await (sb as any).rpc("orders_set_status", { order_id: orderId, status: nextStatus });
      if (rpc?.error) throw rpc.error;

      // Ensure note stored for active orders
      if (wantsLunch) {
        const upd = await sb
          .from("orders")
          .update({ note: nextNote, updated_at: now })
          .eq("id", orderId)
          .eq("company_id", company_id)
          .eq("location_id", location_id)
          .eq("user_id", user_id);
        if (upd.error) throw upd.error;
      }
    } else {
      orderId = existing.id;

      const existingStatus = normalizeExistingStatus((existing as any).status);
      if (existingStatus !== nextStatus) {
        const rpc = await (sb as any).rpc("orders_set_status", { order_id: orderId, status: nextStatus });
        if (rpc?.error) throw rpc.error;
      }

      // Update note (only meaningful for active)
      const upd = await sb
        .from("orders")
        .update({ note: wantsLunch ? nextNote : (existing as any)?.note ?? null, updated_at: now })
        .eq("id", orderId)
        .eq("company_id", company_id)
        .eq("location_id", location_id)
        .eq("user_id", user_id);
      if (upd.error) throw upd.error;
    }

    return jsonOk(rid, {
      ok: true,
      order: {
        id: orderId,
        date,
        status: nextStatus,
        note: wantsLunch ? nextNote : (existing as any)?.note ?? null,
        slot,
        saved_at: now,
      },
    });
  } catch (e: any) {
    console.error("[orders.toggle] ERROR", {
      rid,
      message: String(e?.message ?? e),
      code: e?.code ?? null,
      details: e?.details ?? null,
      hint: e?.hint ?? null,
    });

    return jsonErr(
      rid,
      process.env.NODE_ENV === "production" ? "Kunne ikke lagre." : `Kunne ikke lagre: ${String(e?.message ?? e)}`,
      500,
      "DB_ERROR"
    );
  }
}
