// app/api/orders/toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { getScope, mustCompanyId } from "@/lib/auth/scope";
import { osloTodayISODate } from "@/lib/date/oslo";
import { priceForCompanyDate } from "@/lib/pricing/priceForDate";

/* =========================================================
   Response helpers
========================================================= */

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json(
    { ok: false, rid, error, message, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
}
function makeRid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

/* =========================================================
   Validators / helpers
========================================================= */

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function sanitizeChoiceKey(v: any): string | null {
  const s = safeText(v);
  if (!s) return null;
  // tillat a-z0-9_- (samme som parse-regex i window)
  if (!/^[a-z0-9_\-]+$/i.test(s)) return null;
  return s.toLowerCase();
}

function weekdayFromIsoOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  // Stabilt i Oslo: bruk midt på dagen i UTC og formater i Europe/Oslo
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Oslo" })
    .format(d)
    .toLowerCase();
  if (wd.startsWith("mon")) return "mon";
  if (wd.startsWith("tue")) return "tue";
  if (wd.startsWith("wed")) return "wed";
  if (wd.startsWith("thu")) return "thu";
  if (wd.startsWith("fri")) return "fri";
  if (wd.startsWith("sat")) return "sat";
  return "sun";
}

function isLockedByCutoffOslo(dateISO: string, cutoffHHMM = "08:00") {
  // Lås kun samme dag etter cutoff, i Europe/Oslo.
  const now = new Date();

  const todayOslo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD

  if (dateISO !== todayOslo) return false;

  const [hh, mm] = cutoffHHMM.split(":").map((x) => Number(x));

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  if (h > hh) return true;
  if (h === hh && m >= mm) return true;
  return false;
}

/* =========================================================
   NOTE helpers (bevar andre linjer)
========================================================= */

/**
 * Extract existing choice from note (line starting with choice:)
 */
function parseChoiceFromNote(note: any): string | null {
  const s = String(note ?? "").trim();
  if (!s) return null;
  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const hit = lines.find((l) => l.toLowerCase().startsWith("choice:"));
  if (!hit) return null;
  const key = hit.slice("choice:".length).trim();
  return sanitizeChoiceKey(key);
}

// Set/replace only choice: line, keep others
function setChoiceInNote(note: string | null | undefined, choiceKey: string) {
  const lines = String(note ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rest = lines.filter((l) => !l.toLowerCase().startsWith("choice:"));
  return [`choice:${choiceKey}`, ...rest].join("\n");
}

// Remove only choice: line, keep others (or null)
function clearChoiceInNote(note: string | null | undefined) {
  const lines = String(note ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rest = lines.filter((l) => !l.toLowerCase().startsWith("choice:"));
  return rest.length ? rest.join("\n") : null;
}

/* =========================================================
   Agreement -> allowed choices (hard validation + default)
========================================================= */

function tryParseJson(v: any) {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function toKeyList(input: any): string[] {
  const out: string[] = [];
  const push = (k: any) => {
    const kk = sanitizeChoiceKey(k);
    if (kk && !out.includes(kk)) out.push(kk);
  };

  if (!input) return out;

  if (Array.isArray(input)) {
    for (const v of input) {
      if (typeof v === "string") push(v);
      else if (v && typeof v === "object") push((v as any).key ?? (v as any).value ?? (v as any).id);
    }
    return out;
  }

  if (typeof input === "object") {
    // { varmmat:true } or { varmmat:"Varm mat" }
    for (const k of Object.keys(input)) push(k);
  }

  return out;
}

function extractChoicesFromAgreementObj(obj: any, weekday: string): string[] {
  const candidates: any[] = [];

  // global
  candidates.push(obj?.allowed_choices);
  candidates.push(obj?.menu_choices);
  candidates.push(obj?.choices);
  candidates.push(obj?.menu?.choices);
  candidates.push(obj?.menu?.options);
  candidates.push(obj?.options);

  // weekday-specific
  candidates.push(obj?.days?.[weekday]?.choices);
  candidates.push(obj?.weekdays?.[weekday]?.choices);
  candidates.push(obj?.days?.[weekday]?.allowed_choices);
  candidates.push(obj?.weekdays?.[weekday]?.allowed_choices);
  candidates.push(obj?.days?.[weekday]?.menu_choices);
  candidates.push(obj?.weekdays?.[weekday]?.menu_choices);
  candidates.push(obj?.days?.[weekday]?.options);
  candidates.push(obj?.weekdays?.[weekday]?.options);
  candidates.push(obj?.days?.[weekday]?.menu?.choices);
  candidates.push(obj?.weekdays?.[weekday]?.menu?.choices);

  for (const c of candidates) {
    const keys = toKeyList(c);
    if (keys.length) return keys;
  }
  return [];
}

async function getAllowedChoiceKeys(sb: any, company_id: string, dateISO: string): Promise<string[]> {
  const wd = weekdayFromIsoOslo(dateISO);

  // 1) company_current_agreement
  try {
    const { data, error } = await sb
      .from("company_current_agreement")
      .select("company_id, allowed_choices, menu_choices, choices, agreement_json, plan_json")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!error && data) {
      const direct =
        toKeyList((data as any).allowed_choices).length
          ? toKeyList((data as any).allowed_choices)
          : toKeyList((data as any).menu_choices).length
          ? toKeyList((data as any).menu_choices)
          : toKeyList((data as any).choices);

      if (direct.length) return direct;

      const aj = tryParseJson((data as any).agreement_json) ?? tryParseJson((data as any).plan_json);
      if (aj) {
        const keys = extractChoicesFromAgreementObj(aj, wd);
        if (keys.length) return keys;
      }
    }
  } catch {
    // ignore
  }

  // 2) fallback: company_agreements
  try {
    const { data, error } = await sb
      .from("company_agreements")
      .select("company_id, allowed_choices, menu_choices, choices, agreement_json, plan_json")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!error && data) {
      const direct =
        toKeyList((data as any).allowed_choices).length
          ? toKeyList((data as any).allowed_choices)
          : toKeyList((data as any).menu_choices).length
          ? toKeyList((data as any).menu_choices)
          : toKeyList((data as any).choices);

      if (direct.length) return direct;

      const aj = tryParseJson((data as any).agreement_json) ?? tryParseJson((data as any).plan_json);
      if (aj) {
        const keys = extractChoicesFromAgreementObj(aj, wd);
        if (keys.length) return keys;
      }
    }
  } catch {
    // ignore
  }

  return [];
}

function pickDefaultChoice(allowed: string[]): string | null {
  if (!allowed?.length) return null;
  const varm = allowed.find((k) => k === "varmmat");
  if (varm) return varm;
  return allowed[0] ?? null;
}

/* =========================================================
   Types
========================================================= */

type Body = {
  date?: string; // YYYY-MM-DD
  choice_key?: string | null; // UI sitt valg
  slot?: string | null;

  // ✅ Idempotent "SET" støtte (valgfritt)
  wants_lunch?: boolean;

  // metadata
  client_request_id?: string | null;
};

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const rid = makeRid();

  // Scope
  let scope: any;
  try {
    scope = await getScope(req);
  } catch (e) {
    return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget", e);
  }

  const role = String(scope?.role ?? "").trim();
  const user_id = String(scope?.user_id ?? "").trim();

  if (!user_id) return jsonErr(401, rid, "UNAUTHENTICATED", "Mangler user_id i scope");
  if (!role) return jsonErr(401, rid, "UNAUTHENTICATED", "Mangler role i scope");

  if (role === "superadmin") return jsonErr(403, rid, "FORBIDDEN", "Superadmin bruker ikke bestillings-endepunkt");
  if (role !== "employee" && role !== "company_admin") {
    return jsonErr(403, rid, "FORBIDDEN", "Rollen din har ikke tilgang til bestilling");
  }

  const company_id = mustCompanyId(scope);

  // Body
  let body: Body = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const isoDate = safeText(body.date) ?? osloTodayISODate();
  if (!isIsoDate(isoDate)) return jsonErr(400, rid, "BAD_INPUT", "Ugyldig datoformat (forventer YYYY-MM-DD)");

  // Weekend guard
  const wd = weekdayFromIsoOslo(isoDate);
  if (wd === "sat" || wd === "sun") return jsonErr(400, rid, "WEEKEND", "Helg støttes ikke i portalen (Man–Fre).");

  // Cutoff guard
  if (isLockedByCutoffOslo(isoDate, "08:00")) return jsonErr(409, rid, "LOCKED", "Dagen er låst etter 08:00.");

  const choice_key_in = sanitizeChoiceKey((body as any).choice_key);
  const slot = safeText(body.slot);

  // idempotent SET
  const wantsLunch: boolean | null =
    typeof (body as any).wants_lunch === "boolean" ? !!(body as any).wants_lunch : null;

  const sb = await supabaseServer();

  // Location (best effort)
  let location_id: string | null = null;
  try {
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("location_id")
      .eq("user_id", user_id)
      .maybeSingle();
    if (!profErr) location_id = (prof?.location_id as string | null) ?? null;
  } catch {
    location_id = null;
  }

  // ✅ Hard avtalevalidering + tier/pris (én sannhetskilde)
  const price = await priceForCompanyDate(company_id, isoDate);
  if ((price as any).ok === false) {
    const errCode = String((price as any).error ?? "PRICE_ERROR");
    const errMsg = String((price as any).message ?? "Pris/avtale kunne ikke beregnes");

    // idempotent "avbestill" kan besvares OK uten DB-endring
    if (wantsLunch === false) {
      return jsonOk({
        ok: true,
        rid,
        order: { id: null, company_id, user_id, date: isoDate, status: "CANCELLED", note: null, slot: slot ?? null, location_id },
        pricing: { tier: "BASIS", unit_price: 0 },
        ignored: { reason: "NOT_ENABLED_DAY", error: errCode, message: errMsg },
      });
    }

    return jsonErr(400, rid, errCode, errMsg, (price as any).detail);
  }

  // ✅ Hard choices: hent fra avtale (validering + default)
  const allowedChoices = await getAllowedChoiceKeys(sb, company_id, isoDate);

  // Eksisterende order
  const { data: existing, error: existingErr } = await sb
    .from("orders")
    .select("id, status, note, slot, created_at, updated_at")
    .eq("company_id", company_id)
    .eq("user_id", user_id)
    .eq("date", isoDate)
    .maybeSingle();

  if (existingErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lese eksisterende bestilling", existingErr);

  const current = String(existing?.status ?? "CANCELLED").toUpperCase().trim();
  const currentActive = current === "ACTIVE";

  const nextStatus =
    wantsLunch === null
      ? currentActive
        ? "CANCELLED"
        : "ACTIVE"
      : wantsLunch
      ? "ACTIVE"
      : "CANCELLED";

  // ===========================
  // CHOICE RULES (hard + default):
  // - Når ACTIVE: må ende med gyldig choice:
  //   1) choice_key i request (må være allowed)
  //   2) eksisterende choice i note (må være allowed)
  //   3) default: varmmat hvis finnes, ellers første allowed
  // - Hvis avtalen ikke har choices -> NO_CHOICES for ACTIVE
  // ===========================

  const choiceWasProvided = Object.prototype.hasOwnProperty.call(body, "choice_key");
  const hasAllowed = allowedChoices.length > 0;

  let resolvedChoice: string | null = null;

  if (nextStatus === "ACTIVE") {
    if (!hasAllowed) {
      return jsonErr(400, rid, "NO_CHOICES", "Firmaavtalen mangler menyvalg.", { company_id, date: isoDate });
    }

    if (choiceWasProvided) {
      if (!choice_key_in) {
        return jsonErr(400, rid, "BAD_CHOICE", "Mangler gyldig menyvalg.", { company_id, date: isoDate });
      }
      if (!allowedChoices.includes(choice_key_in)) {
        return jsonErr(400, rid, "INVALID_CHOICE", "Ugyldig menyvalg for denne avtalen.", {
          company_id,
          date: isoDate,
          choice_key: choice_key_in,
          allowed: allowedChoices,
        });
      }
      resolvedChoice = choice_key_in;
    } else {
      const existingChoice = parseChoiceFromNote(existing?.note);
      if (existingChoice && allowedChoices.includes(existingChoice)) {
        resolvedChoice = existingChoice;
      } else {
        resolvedChoice = pickDefaultChoice(allowedChoices);
        if (!resolvedChoice) {
          return jsonErr(400, rid, "NO_CHOICES", "Firmaavtalen mangler menyvalg.", { company_id, date: isoDate });
        }
      }
    }
  }

  let order: any = null;

  // ---------- CASE A: No existing ----------
  if (!existing) {
    if (nextStatus === "CANCELLED") {
      // idempotent cancel: do not create row
      return jsonOk({
        ok: true,
        rid,
        order: { id: null, company_id, user_id, date: isoDate, status: "CANCELLED", note: null, slot: slot ?? null, location_id },
        pricing: { tier: (price as any).tier, unit_price: (price as any).unit_price },
      });
    }

    // create ACTIVE (note keeps room for future lines)
    const payload: any = {
      company_id,
      user_id,
      date: isoDate,
      status: "ACTIVE",
      location_id,
      slot,
      note: resolvedChoice ? setChoiceInNote(null, resolvedChoice) : null,
    };

    const { data: created, error: insErr } = await sb.from("orders").insert(payload).select("*").single();
    if (insErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke opprette bestilling", insErr);
    order = created;
  } else {
    // ---------- CASE B: Existing ----------
    const patch: any = {};

    if (nextStatus !== current) patch.status = nextStatus;

    // slot: update only if provided
    if (Object.prototype.hasOwnProperty.call(body, "slot")) patch.slot = slot;

    // note:
    // - ACTIVE: set/replace choice: line, preserve other lines
    // - CANCELLED: remove choice: line, preserve other lines if any
    if (nextStatus === "ACTIVE") {
      const nextNote = resolvedChoice ? setChoiceInNote(existing.note, resolvedChoice) : existing.note ?? null;
      if (String(nextNote ?? "") !== String(existing.note ?? "")) patch.note = nextNote;
    } else {
      const nextNote = clearChoiceInNote(existing.note);
      if (String(nextNote ?? "") !== String(existing.note ?? "")) patch.note = nextNote;
    }

    if (Object.keys(patch).length === 0) {
      order = existing;
    } else {
      const { data: updated, error: updErr } = await sb.from("orders").update(patch).eq("id", existing.id).select("*").single();
      if (updErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke oppdatere bestilling", updErr);
      order = updated;
    }
  }

  // saved_at for UI kvittering
  const saved_at = (order as any)?.updated_at ?? (order as any)?.created_at ?? null;

  return jsonOk({
    ok: true,
    rid,
    order: {
      ...(order ?? {}),
      saved_at,
    },
    pricing: { tier: (price as any).tier, unit_price: (price as any).unit_price },
  });
}
