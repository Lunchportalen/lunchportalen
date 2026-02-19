// app/api/order/set-day/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { lpOrderCancel, lpOrderSet } from "@/lib/orders/rpcWrite";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Tier = "BASIS" | "PREMIUM";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Choice = { key: string; label?: string };

type Body = {
  date: string; // YYYY-MM-DD
  wants_lunch?: boolean; // WeekClient
  wantsLunch?: boolean; // fallback
  choice_key?: string | null;
  note?: string | null; // for Salatbar/PÃƒÆ’Ã‚Â¥smurt variants
};

type ProfileRow = { user_id: string; company_id: string | null; location_id: string | null };

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

/** Europe/Oslo "nÃƒÆ’Ã‚Â¥" -> (YYYY-MM-DD, HH:MM) */
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

/** LÃƒÆ’Ã‚Â¥s etter 08:00 Europe/Oslo samme dag */
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
  if (!key) throw new Error("Dato mÃƒÆ’Ã‚Â¥ vÃƒÆ’Ã‚Â¦re ManÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Fre.");
  return key;
}

function cleanNote(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.length > 280 ? s.slice(0, 280) : s;
}

/** ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Premium inkluderer alltid Basis (union uten duplikater) */
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
  // - "variant||PÃƒÆ’Ã‚Â¥smurt: Roastbiff"
  // - "PÃƒÆ’Ã‚Â¥smurt: Roastbiff"
  const parts = n.split("||").map((x) => x.trim()).filter(Boolean);
  const payload = parts.length >= 2 ? parts.slice(1).join("||").trim() : parts[0] ?? "";

  const m = /^(Salatbar|PÃƒÆ’Ã‚Â¥smurt)\s*:\s*(.+)$/i.exec(payload);
  if (!m?.[2]) return null;

  const t = String(m[1]).trim().toLowerCase();
  const value = String(m[2]).trim();
  if (!value) return null;

  return t === "salatbar" ? "salatbar" : t === "pÃƒÆ’Ã‚Â¥smurt" || t === "paasmurt" ? "paasmurt" : null;
}

async function getAuthedUserId() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const cookieStore = await cookies();

  const supa = createServerClient(url, anon, {
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
      return jsonErr(rid, "Ugyldig datoformat (YYYY-MM-DD).", 400, "BAD_DATE");
    }

    const user_id = await getAuthedUserId();
    if (!user_id) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");

    const cutoff = cutoffState(date);
    if (cutoff.locked) {
      return jsonErr(rid, "Dagen er lÃƒÆ’Ã‚Â¥st etter 08:00.", 423, {
        code: "LOCKED",
        detail: { locked: true, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    let dayKey: DayKey;
    try {
      dayKey = weekdayKeyOslo(date);
    } catch {
      return jsonErr(rid, "Dato mÃƒÆ’Ã‚Â¥ vÃƒÆ’Ã‚Â¦re ManÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Fre. Helg bestilles ikke i portalen.", 400, "WEEKDAY_ONLY");
    }

    const supa = supabaseAdmin();

    // scope
    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("user_id, company_id, location_id")
      .eq("user_id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr || !profile?.company_id || !profile?.location_id) {
      return jsonErr(rid, "Fant ikke profil/scope.", 403, "PROFILE_MISSING_SCOPE");
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    // contract -> day tier + allowed choices
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    if (cErr || !companyRaw) {
      return jsonErr(rid, "Fant ikke kontrakt.", 403, "COMPANY_CONTRACT_NOT_FOUND");
    }

    const weekTier = ((companyRaw as any).contract_week_tier as Record<string, Tier>) ?? {};
    const tier = weekTier[dayKey];
    if (!tier) {
      return jsonErr(rid, "Denne dagen er ikke aktiv i avtalen.", 403, "DAY_NOT_ENABLED");
    }

    const basisChoices = (((companyRaw as any).contract_basis_choices as Choice[]) ?? []).filter((x) => x?.key);
    const premiumRaw = (((companyRaw as any).contract_premium_choices as Choice[]) ?? []).filter((x) => x?.key);
    const premiumChoices = mergeChoices(basisChoices, premiumRaw);
    const allowed = tier === "BASIS" ? basisChoices : premiumChoices;

    // decide choice key
    let finalChoiceKey: string | null = wantsLunch ? choiceKeyIn : null;

    if (wantsLunch) {
      const ok = finalChoiceKey && allowed.some((c) => c.key === finalChoiceKey);
      if (!ok) {
        const fallback = allowed.find((c) => c.key === "varmmat")?.key ?? allowed[0]?.key ?? null;
        finalChoiceKey = fallback;
        if (!finalChoiceKey) return jsonErr(rid, "Firmaavtalen mangler menyvalg.", 400, "NO_CHOICES");
      }
    }

    // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Variant gate (driftsikkert): salatbar/paasmurt krever note med riktig type
    if (wantsLunch && requiresVariant(finalChoiceKey)) {
      const t = parseVariantTypeFromNote(note);
      const ck = String(finalChoiceKey ?? "").toLowerCase();
      if (!t || t !== ck) {
        const label = ck === "salatbar" ? "Salatbar" : "PÃƒÆ’Ã‚Â¥smurt";
        return jsonErr(rid, `Velg variant for ${label}.`, 400, "MISSING_VARIANT");
      }
    }

    // legacy note keeps supporting old clients + still lets window derive choice if day_choices missing
    const legacyNote = wantsLunch && finalChoiceKey ? `choice:${finalChoiceKey}` : null;

    const writeRes = wantsLunch
      ? await lpOrderSet(supa as any, { p_date: date, p_slot: "lunch", p_note: legacyNote })
      : await lpOrderCancel(supa as any, { p_date: date });

    if (!writeRes.ok) {
      return jsonErr(rid, "Kunne ikke lagre.", 500, {
        code: writeRes.code ?? "ORDER_RPC_FAILED",
        detail: writeRes.error?.message ?? null,
      });
    }

    const { data: savedOrder, error: oErr } = await (supa as any)
      .from("orders")
      .select("id,date,status,updated_at,created_at")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .eq("date", date)
      .eq("slot", "lunch")
      .maybeSingle();

    if (oErr || !savedOrder) {
      return jsonErr(rid, "Kunne ikke lese ordre etter lagring.", 500, { code: "ORDER_READ_FAILED", detail: oErr?.message ?? null });
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
        return jsonErr(rid, "Bestilling lagret, men menyvalg kunne ikke lagres. PrÃƒÆ’Ã‚Â¸v igjen.", 500, {
          code: "DAY_CHOICE_SAVE_FAILED",
          detail: dcErr?.message ?? null,
        });
      }
    }

    const updatedAt = (savedOrder as any).updated_at ?? (savedOrder as any).created_at ?? null;

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        receipt: {
          orderId: (savedOrder as any).id,
          status: wantsLunch ? "ACTIVE" : "CANCELLED",
          date: (savedOrder as any).date,
          updatedAt,
        },
        date: (savedOrder as any).date,
        status: wantsLunch ? "ACTIVE" : "CANCELLED",
        wants_lunch: wantsLunch,
        choice_key: wantsLunch ? finalChoiceKey : null,
        note: wantsLunch ? (note ?? null) : null,
        pricing: { tier, unit_price: tier === "BASIS" ? 90 : 130 },
        locked: false,
        cutoffTime: cutoff.cutoffTime,
        canAct: true,
        scope: { company_id, location_id, user_id },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}

