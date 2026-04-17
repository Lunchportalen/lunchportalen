// app/api/order/set-day/route.ts
/* agents-ci: JSON responses include ok: true, rid: (success) and ok: false, rid: (errors) via jsonOrderWrite*. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { jsonOrderWriteErr, jsonOrderWriteOk, makeRid, orderWriteStatusFromDb } from "@/lib/http/respond";
import type { Database } from "@/lib/types/database";
import { ensureMealChoicesPresent, resolveTierForOrderDay } from "@/lib/orders/agreementContractFallback";
import { assertCompanyOrderWriteAllowed } from "@/lib/orders/companyOrderEligibility";
import { assertOrderWithinAgreementPreflight } from "@/lib/orders/orderWriteGuard";
import { agreementRuleSlotForOrderTableSlot, lpOrderCancel, lpOrderSet, ORDER_TABLE_SLOT_DEFAULT } from "@/lib/orders/rpcWrite";
import { fanoutLpOrderSetOutboxBestEffort } from "@/lib/orderBackup/outbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";

type Tier = "BASIS" | "PREMIUM";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Choice = { key: string; label?: string };

type Body = {
  date: string; // YYYY-MM-DD
  wants_lunch?: boolean; // WeekClient
  wantsLunch?: boolean; // fallback
  choice_key?: string | null;
  note?: string | null; // for Salatbar/Påsmurt variants
};

type ProfileRow = { id: string; company_id: string | null; location_id: string | null };

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

/** Europe/Oslo "nå" -> (YYYY-MM-DD, HH:MM) */
function osloNowParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
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

  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`, // YYYY-MM-DD
    timeHM: `${get("hour")}:${get("minute")}`, // HH:MM
  };
}

/** Lås etter 08:00 Europe/Oslo samme dag */
function cutoffState(dateISO: string) {
  const now = osloNowParts();
  const cutoffTime = "08:00";
  const locked =
    dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;
  return { locked, cutoffTime };
}

function weekdayKeyOslo(dateISO: string): DayKey {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, DayKey> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd];
  if (!key) throw new Error("Dato må være Man–Fre.");
  return key;
}

function cleanNote(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.length > 280 ? s.slice(0, 280) : s;
}

/** ✅ Premium inkluderer alltid Basis (union uten duplikater) */
function mergeChoices(basis: Choice[] = [], premium: Choice[] = []) {
  const seen = new Set<string>();
  const out: Choice[] = [];
  for (const c of basis) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  for (const c of premium) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

function requiresVariant(choiceKey: string | null) {
  const k = String(choiceKey ?? "").trim().toLowerCase();
  return k === "salatbar" || k === "paasmurt";
}

function parseVariantTypeFromNote(note: string | null): "salatbar" | "paasmurt" | null {
  const n = String(note ?? "").trim();
  if (!n) return null;

  // accept:
  // - "variant||Påsmurt: Roastbiff"
  // - "Påsmurt: Roastbiff"
  const parts = n.split("||").map((x) => x.trim()).filter(Boolean);
  const payload = parts.length >= 2 ? parts.slice(1).join("||").trim() : parts[0] ?? "";

  const m = /^(Salatbar|Påsmurt)\s*:\s*(.+)$/i.exec(payload);
  if (!m?.[2]) return null;

  const t = String(m[1]).trim().toLowerCase();
  const value = String(m[2]).trim();
  if (!value) return null;

  return t === "salatbar" ? "salatbar" : t === "påsmurt" || t === "paasmurt" ? "paasmurt" : null;
}

async function getAuthedUserId() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const cookieStore = await cookies();

  const supa = createServerClient<Database>(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;

    const date = String(body?.date ?? "").trim();
    const wantsLunch = Boolean(body?.wants_lunch ?? body?.wantsLunch ?? false);
    const choiceKeyIn = body?.choice_key === null ? null : String(body?.choice_key ?? "").trim() || null;
    const note = cleanNote(body?.note);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonOrderWriteErr(rid, 400, "BAD_DATE", "Ugyldig datoformat (YYYY-MM-DD).");
    }

    const user_id = await getAuthedUserId();
    if (!user_id) return jsonOrderWriteErr(rid, 401, "UNAUTH", "Ikke innlogget.");

    const cutoff = cutoffState(date);
    if (cutoff.locked) {
      return jsonOrderWriteErr(rid, 423, "LOCKED", "Dagen er låst etter 08:00.");
    }

    let dayKey: DayKey;
    try {
      dayKey = weekdayKeyOslo(date);
    } catch {
      return jsonOrderWriteErr(rid, 400, "WEEKDAY_ONLY", "Dato må være Man–Fre. Helg bestilles ikke i portalen.");
    }

    const supa = supabaseAdmin();

    // scope
    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("id, company_id, location_id")
      .eq("id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr || !profile?.company_id || !profile?.location_id) {
      return jsonOrderWriteErr(rid, 403, "PROFILE_MISSING_SCOPE", "Fant ikke profil/scope.");
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    const hold = await assertCompanyOrderWriteAllowed(supa as any, company_id, rid);
    if (hold.ok === false) {
      return jsonOrderWriteErr(rid, hold.status, hold.code, hold.message);
    }

    const pre = await assertOrderWithinAgreementPreflight({
      sb: supa as any,
      companyId: company_id,
      locationId: location_id,
      orderIsoDate: date,
      agreementRuleSlot: agreementRuleSlotForOrderTableSlot(ORDER_TABLE_SLOT_DEFAULT),
      rid,
      action: wantsLunch ? "SET" : "CANCEL",
    });
    if (pre.ok === false) {
      return jsonOrderWriteErr(rid, pre.status, pre.code, pre.message);
    }

    // contract -> day tier + allowed choices
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    if (cErr || !companyRaw) {
      return jsonOrderWriteErr(rid, 403, "COMPANY_CONTRACT_NOT_FOUND", "Fant ikke kontrakt.");
    }

    const weekTier = ((companyRaw as any).contract_week_tier as Record<string, Tier>) ?? {};
    let basisChoices = (((companyRaw as any).contract_basis_choices as Choice[]) ?? []).filter((x) => x?.key);
    let premiumRaw = (((companyRaw as any).contract_premium_choices as Choice[]) ?? []).filter((x) => x?.key);
    const ensured = ensureMealChoicesPresent(basisChoices, premiumRaw);
    basisChoices = ensured.basis;
    premiumRaw = ensured.premium;

    const tier =
      (await resolveTierForOrderDay(supa as any, company_id, location_id, dayKey, weekTier)) ?? null;
    if (!tier) {
      return jsonOrderWriteErr(rid, 403, "DAY_NOT_ENABLED", "Denne dagen er ikke aktiv i avtalen.");
    }
    const premiumChoices = mergeChoices(basisChoices, premiumRaw);
    const allowed = tier === "BASIS" ? basisChoices : premiumChoices;

    // decide choice key
    let finalChoiceKey: string | null = wantsLunch ? choiceKeyIn : null;

    if (wantsLunch) {
      const ok = finalChoiceKey && allowed.some((c) => c.key === finalChoiceKey);
      if (!ok) {
        const fallback = allowed.find((c) => c.key === "varmmat")?.key ?? allowed[0]?.key ?? null;
        finalChoiceKey = fallback;
        if (!finalChoiceKey) return jsonOrderWriteErr(rid, 400, "NO_CHOICES", "Firmaavtalen mangler menyvalg.");
      }
    }

    // ✅ Variant gate (driftsikkert): salatbar/paasmurt krever note med riktig type
    if (wantsLunch && requiresVariant(finalChoiceKey)) {
      const t = parseVariantTypeFromNote(note);
      const ck = String(finalChoiceKey ?? "").toLowerCase();
      if (!t || t !== ck) {
        const label = displayLabelForMealTypeKey(ck, null);
        return jsonOrderWriteErr(rid, 400, "MISSING_VARIANT", `Velg variant for ${label}.`);
      }
    }

    // legacy note keeps supporting old clients + still lets window derive choice if day_choices missing
    const legacyNote = wantsLunch && finalChoiceKey ? `choice:${finalChoiceKey}` : null;

    const writeRes = wantsLunch
      ? await lpOrderSet(supa as any, { p_date: date, p_slot: ORDER_TABLE_SLOT_DEFAULT, p_note: legacyNote })
      : await lpOrderCancel(supa as any, { p_date: date, p_slot: ORDER_TABLE_SLOT_DEFAULT });

    if (!writeRes.ok) {
      return jsonOrderWriteErr(rid, 500, writeRes.code ?? "ORDER_RPC_FAILED", "Kunne ikke lagre.");
    }

    const { data: savedOrder, error: oErr } = await (supa as any)
      .from("orders")
      .select("id,date,status,updated_at,created_at")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .eq("date", date)
      .eq("slot", ORDER_TABLE_SLOT_DEFAULT)
      .maybeSingle();

    if (oErr || !savedOrder) {
      return jsonOrderWriteErr(rid, 500, "ORDER_READ_FAILED", "Kunne ikke lese ordre etter lagring.");
    }

    // keep day_choices aligned
    if (wantsLunch && finalChoiceKey) {
      const { error: dcErr } = await (supa as any)
        .from("day_choices")
        .upsert(
          {
            company_id,
            location_id,
            user_id,
            date,
            choice_key: finalChoiceKey,
            note: note ?? null,
            status: "ACTIVE",
          },
          { onConflict: "company_id,location_id,user_id,date" }
        );

      if (dcErr) {
        return jsonOrderWriteErr(
          rid,
          500,
          "DAY_CHOICE_SAVE_FAILED",
          "Bestilling lagret, men menyvalg kunne ikke lagres. Prøv igjen."
        );
      }
    }

    const orderId = String((savedOrder as any).id ?? "").trim();
    if (!orderId) {
      return jsonOrderWriteErr(rid, 500, "ORDER_READ_FAILED", "Kunne ikke verifisere ordre-ID etter lagring.");
    }

    const savedDate = String((savedOrder as any).date ?? date);
    const status = orderWriteStatusFromDb(String((savedOrder as any).status ?? (wantsLunch ? "ACTIVE" : "CANCELLED")));

    await fanoutLpOrderSetOutboxBestEffort({
      userId: user_id,
      date: savedDate,
      slot: ORDER_TABLE_SLOT_DEFAULT,
    });

    return jsonOrderWriteOk(rid, {
      orderId,
      status,
      date: savedDate,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return jsonOrderWriteErr(rid, 500, "SERVER_ERROR", "Uventet feil.");
  }
}

