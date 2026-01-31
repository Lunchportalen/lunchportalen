// app/api/order/set-day/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  const rid = `setday_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;

    const date = String(body?.date ?? "").trim();
    const wantsLunch = !!body?.wantsLunch;
    const choiceKeyIn = body?.choice_key === null ? null : String(body?.choice_key ?? "").trim() || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, rid, error: "BAD_DATE", message: "Ugyldig datoformat (YYYY-MM-DD)." }, { status: 400 });
    }

    const user_id = await getAuthedUserId();
    if (!user_id) {
      return NextResponse.json({ ok: false, rid, error: "UNAUTH", message: "Ikke innlogget." }, { status: 401 });
    }

    if (isLocked(date)) {
      return NextResponse.json({ ok: false, rid, error: "LOCKED", message: "Dagen er låst etter 08:00." }, { status: 423 });
    }

    let dayKey: DayKey;
    try {
      dayKey = weekdayKeyOslo(date);
    } catch {
      return NextResponse.json({ ok: false, rid, error: "WEEKDAY_ONLY", message: "Dato må være Man–Fre." }, { status: 400 });
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
      return NextResponse.json({ ok: false, rid, error: "PROFILE_MISSING_SCOPE", message: "Fant ikke profil/scope." }, { status: 403 });
    }

    const { company_id, location_id } = profile;

    // Contract: tier-plan + choices
    const { data: company, error: cErr } = await supa
      .from("companies")
      .select("contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    if (cErr || !company) {
      return NextResponse.json({ ok: false, rid, error: "COMPANY_CONTRACT_NOT_FOUND", message: "Fant ikke kontrakt." }, { status: 403 });
    }

    const weekTier = (company.contract_week_tier as Record<string, Tier>) ?? {};
    const tier = weekTier[dayKey];
    if (!tier) {
      return NextResponse.json({ ok: false, rid, error: "DAY_NOT_ENABLED", message: "Denne dagen er ikke aktiv i avtalen." }, { status: 403 });
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
          return NextResponse.json(
            { ok: false, rid, error: "NO_CHOICES", message: "Firmaavtalen mangler menyvalg." },
            { status: 400 }
          );
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
      return NextResponse.json({ ok: false, rid, error: "SAVE_FAILED", message: "Kunne ikke lagre.", detail: uErr?.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rid, orderId: up.id, savedAt: up.updated_at });
  } catch (e: any) {
    return NextResponse.json({ ok: false, rid, error: "SERVER_ERROR", detail: String(e?.message ?? e) }, { status: 500 });
  }
}



