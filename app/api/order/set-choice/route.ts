// app/api/order/set-choice/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type Body = {
  date: string; // YYYY-MM-DD
  choice_key: string; // f.eks. "salatbar", "varmmat"
};

type Choice = { key: string; label?: string };

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

function isLockedByCutoff(dateISO: string) {
  // Lås etter 08:00 Europe/Oslo samme dag
  const now = osloNowParts();
  if (dateISO < now.dateISO) return true;
  if (dateISO > now.dateISO) return false;
  return now.timeHM >= "08:00";
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  // Safe parsing til UTC-midday for å unngå DST-edge
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(d);

  const map: Record<string, any> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };

  const key = map[wd];
  if (!key) throw new Error("Dato må være Man–Fre.");
  return key;
}

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

async function getAuthedUserId() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // NB: i din Next-versjon er cookies() async
  const cookieStore = await cookies();

  const supa = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // I route handler trenger vi ikke å sette/fjerne cookies
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function POST(req: Request) {
  try {
    const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

    const body = (await req.json()) as Partial<Body>;
    const date = (body.date ?? "").trim();
    const choice_key = (body.choice_key ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, error: "Ugyldig datoformat. Bruk YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (!choice_key) {
      return NextResponse.json({ ok: false, error: "choice_key mangler." }, { status: 400 });
    }

    // 1) Auth (cookie-basert)
    const user_id = await getAuthedUserId();
    if (!user_id) {
      return NextResponse.json({ ok: false, error: "Ikke innlogget." }, { status: 401 });
    }

    // 2) Cutoff-lås
    if (isLockedByCutoff(date)) {
      return NextResponse.json({ ok: false, error: "Dagen er låst etter 08:00." }, { status: 409 });
    }

    // 3) Ukedag (Man–Fre)
    let dayKey: "mon" | "tue" | "wed" | "thu" | "fri";
    try {
      dayKey = weekdayKeyOslo(date);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Dato må være Man–Fre. Helg bestilles ikke i portalen." },
        { status: 400 }
      );
    }

    // 4) Service client (bypasser RLS) for kontrakt + upsert
    const supa = createClient(url, service, { auth: { persistSession: false } });

    // 5) Profil -> firma + lokasjon
    const { data: profile, error: pErr } = await supa
      .from("profiles")
      .select("user_id, company_id, location_id, role")
      .eq("user_id", user_id)
      .single();

    if (pErr || !profile) {
      return NextResponse.json({ ok: false, error: "Fant ikke profil." }, { status: 403 });
    }

    const company_id = profile.company_id as string;
    const location_id = profile.location_id as string;

    if (!company_id || !location_id) {
      return NextResponse.json(
        { ok: false, error: "Profil mangler company_id/location_id." },
        { status: 403 }
      );
    }

    // 6) Hent kontrakt fra companies
    const { data: company, error: cErr } = await supa
      .from("companies")
      .select("id, contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    if (cErr || !company) {
      return NextResponse.json({ ok: false, error: "Fant ikke firma/kontrakt." }, { status: 403 });
    }

    const weekTier = (company as any).contract_week_tier as Record<string, "BASIS" | "PREMIUM"> | null;
    if (!weekTier) {
      return NextResponse.json({ ok: false, error: "Kontrakt mangler contract_week_tier." }, { status: 400 });
    }

    const tier = weekTier[dayKey];
    if (!tier) {
      return NextResponse.json(
        { ok: false, error: "Kontrakt mangler tier-plan for denne dagen." },
        { status: 400 }
      );
    }

    const basisChoices = (company as any).contract_basis_choices as Choice[] | null;
    const premiumChoices = (company as any).contract_premium_choices as Choice[] | null;

    const allowed: Choice[] | null = tier === "BASIS" ? basisChoices : premiumChoices;

    if (!Array.isArray(allowed) || allowed.length === 0) {
      return NextResponse.json({ ok: false, error: "Kontrakt mangler menyvalg." }, { status: 400 });
    }

    if (!allowed.some((x) => x?.key === choice_key)) {
      return NextResponse.json({ ok: false, error: `Ugyldig valg for ${tier}-dag.` }, { status: 400 });
    }

    // 7) Upsert til day_choices (én rad per dag per ansatt)
    const { data: upserted, error: uErr } = await supa
      .from("day_choices")
      .upsert(
        {
          company_id,
          location_id,
          user_id,
          date,
          choice_key,
          status: "ACTIVE",
        },
        { onConflict: "company_id,location_id,user_id,date" }
      )
      .select("id, date, choice_key, updated_at")
      .single();

    if (uErr || !upserted) {
      return NextResponse.json(
        { ok: false, error: "Kunne ikke lagre valg.", detail: String(uErr?.message ?? uErr) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      date: upserted.date,
      choice_key: upserted.choice_key,
      tier,
      updated_at: upserted.updated_at,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Uventet feil.", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
