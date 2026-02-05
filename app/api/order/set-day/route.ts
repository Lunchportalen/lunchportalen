// app/api/order/set-day/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type Tier = "BASIS" | "PREMIUM";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Choice = { key: string; label?: string };

type Body = {
  date: string;
  wantsLunch: boolean;
  choice_key: string | null;
};

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

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
  return { dateISO: `${get("year")}-${get("month")}-${get("day")}`, timeHM: `${get("hour")}:${get("minute")}` };
}

function isLocked(dateISO: string) {
  const now = osloNowParts();
  if (dateISO < now.dateISO) return true;
  if (dateISO > now.dateISO) return false;
  return now.timeHM >= "08:00";
}

function weekdayKeyOslo(dateISO: string): DayKey {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, DayKey> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd as keyof typeof map];
  if (!key) throw new Error("Dato må være Man–Fre.");
  return key;
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

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;

    const date = String(body?.date ?? "").trim();
    const wantsLunch = !!body?.wantsLunch;
    const choiceKeyIn = body?.choice_key === null ? null : String(body?.choice_key ?? "").trim() || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonErr(rid, "Ugyldig datoformat (YYYY-MM-DD).", 400, "BAD_DATE");
    }

    const user_id = await getAuthedUserId();
    if (!user_id) {
      return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");
    }

    if (isLocked(date)) {
      return jsonErr(rid, "Dagen er l�st etter 08:00.", 423, "LOCKED");
    }

    let dayKey: DayKey;
    try {
      dayKey = weekdayKeyOslo(date);
    } catch {
      return jsonErr(rid, "Dato m� v�re Man�Fre.", 400, "WEEKDAY_ONLY");
    }

    const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
    const supa = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    // Scope
    const { data: profile, error: pErr } = await supa
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", user_id)
      .single();

    if (pErr || !profile?.company_id || !profile?.location_id) {
      return jsonErr(rid, "Fant ikke profil/scope.", 403, "PROFILE_MISSING_SCOPE");
    }

    const { company_id, location_id } = profile;

    // Contract: tier-plan + choices
    const { data: company, error: cErr } = await supa
      .from("companies")
      .select("contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    if (cErr || !company) {
      return jsonErr(rid, "Fant ikke kontrakt.", 403, "COMPANY_CONTRACT_NOT_FOUND");
    }

    const weekTier = (company.contract_week_tier as Record<string, Tier>) ?? {};
    const tier = weekTier[dayKey];
    if (!tier) {
      return jsonErr(rid, "Denne dagen er ikke aktiv i avtalen.", 403, "DAY_NOT_ENABLED");
    }

    const basisChoices = ((company as any).contract_basis_choices as Choice[]) ?? [];
    const premiumRaw = ((company as any).contract_premium_choices as Choice[]) ?? [];
    const premiumChoices = mergeChoices(basisChoices, premiumRaw);
    const allowed = tier === "BASIS" ? basisChoices : premiumChoices;

    // ✅ Hard guarantee: avbestilling => choice_key null
    const cleanedChoiceKey = wantsLunch ? choiceKeyIn : null;

    // Hvis bestilling: choice_key må være tillatt (eller vi auto-setter default)
    let finalChoiceKey = cleanedChoiceKey;

    if (wantsLunch) {
      const ok = finalChoiceKey && allowed.some((c) => c.key === finalChoiceKey);
      if (!ok) {
        // Default: varmmat hvis finnes, ellers første i listen
        const fallback = allowed.find((c) => c.key === "varmmat")?.key ?? allowed[0]?.key ?? null;
        finalChoiceKey = fallback;

        if (!finalChoiceKey) {
          return jsonErr(rid, "Firmaavtalen mangler menyvalg.", 400, "NO_CHOICES");
        }
      }
    }

    const { data: up, error: uErr } = await supa
      .from("day_orders")
      .upsert(
        {
          company_id,
          location_id,
          user_id,
          date,
          wants_lunch: wantsLunch,
          choice_key: finalChoiceKey,
          status: "ACTIVE",
        },
        { onConflict: "company_id,location_id,user_id,date" }
      )
      .select("id, updated_at")
      .single();

    if (uErr || !up) {
      return jsonErr(rid, "Kunne ikke lagre.", 500, { code: "SAVE_FAILED", detail: uErr?.message ?? null });
    }

    return jsonOk(rid, { orderId: up.id, savedAt: up.updated_at });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}






