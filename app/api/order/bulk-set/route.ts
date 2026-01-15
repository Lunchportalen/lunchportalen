// app/api/order/bulk-set/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type Body = {
  // hvis tier settes, gjelder det bare dager med denne tier
  tier?: "BASIS" | "PREMIUM";
  // hvis weekIndex settes: 0 = første uke (5 dager), 1 = andre uke (5 dager)
  weekIndex?: 0 | 1;
  choice_key: string;
};

type Choice = { key: string; label?: string };

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

  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    timeHM: `${get("hour")}:${get("minute")}`,
  };
}

function isLocked(dateISO: string) {
  const now = osloNowParts();
  if (dateISO < now.dateISO) return true;
  if (dateISO > now.dateISO) return false;
  return now.timeHM >= "08:00";
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, any> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd];
  if (!key) throw new Error("Kun Man–Fre er gyldig.");
  return key;
}

function getNextWeekdays(startISO: string, days: number) {
  const out: string[] = [];
  let d = new Date(`${startISO}T00:00:00Z`);
  while (out.length < days) {
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wd)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
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

export async function POST(req: Request) {
  try {
    const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

    const user_id = await getAuthedUserId();
    if (!user_id) {
      return NextResponse.json({ ok: false, error: "Ikke innlogget." }, { status: 401 });
    }

    const body = (await req.json()) as Partial<Body>;
    const choice_key = (body.choice_key ?? "").trim();
    const tierFilter = body.tier;
    const weekIndex = body.weekIndex;

    if (!choice_key) {
      return NextResponse.json({ ok: false, error: "choice_key mangler." }, { status: 400 });
    }
    if (tierFilter && tierFilter !== "BASIS" && tierFilter !== "PREMIUM") {
      return NextResponse.json({ ok: false, error: "Ugyldig tier." }, { status: 400 });
    }
    if (weekIndex !== undefined && weekIndex !== 0 && weekIndex !== 1) {
      return NextResponse.json({ ok: false, error: "Ugyldig weekIndex." }, { status: 400 });
    }

    const supa = createClient(url, service, { auth: { persistSession: false } });

    // profil
    const { data: profile } = await supa
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", user_id)
      .single();

    if (!profile) return NextResponse.json({ ok: false, error: "Fant ikke profil." }, { status: 403 });

    const { company_id, location_id } = profile;

    // kontrakt
    const { data: company } = await supa
      .from("companies")
      .select("contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    if (!company) return NextResponse.json({ ok: false, error: "Fant ikke kontrakt." }, { status: 403 });

    const weekTier = company.contract_week_tier as Record<string, "BASIS" | "PREMIUM">;
    const basisChoices = company.contract_basis_choices as Choice[];
    const premiumChoices = company.contract_premium_choices as Choice[];

    // bygg 2 uker (10 hverdager) og filtrer på uke hvis ønsket
    const today = osloNowParts().dateISO;
    const datesAll = getNextWeekdays(today, 10);
    const dates = weekIndex === undefined ? datesAll : datesAll.slice(weekIndex * 5, weekIndex * 5 + 5);

    // finn tillatte datoer (ikke låst + passer tierFilter + choice_key lovlig for den dagen)
    const targets: string[] = [];
    const skippedLocked: string[] = [];
    const skippedNotAllowed: string[] = [];

    for (const date of dates) {
      if (isLocked(date)) {
        skippedLocked.push(date);
        continue;
      }

      const dayKey = weekdayKeyOslo(date);
      const tier = weekTier[dayKey];
      if (!tier) {
        skippedNotAllowed.push(date);
        continue;
      }

      if (tierFilter && tier !== tierFilter) continue;

      const allowed = tier === "BASIS" ? basisChoices : premiumChoices;
      const okChoice = Array.isArray(allowed) && allowed.some((x) => x?.key === choice_key);
      if (!okChoice) {
        skippedNotAllowed.push(date);
        continue;
      }

      targets.push(date);
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skippedLocked,
        skippedNotAllowed,
        message: "Ingen dager å oppdatere (enten låst eller ikke tillatt).",
      });
    }

    // upsert batch
    const rows = targets.map((date) => ({
      company_id,
      location_id,
      user_id,
      date,
      choice_key,
      status: "ACTIVE",
    }));

    const { error: uErr } = await supa.from("day_choices").upsert(rows, {
      onConflict: "company_id,location_id,user_id,date",
    });

    if (uErr) {
      return NextResponse.json(
        { ok: false, error: "Kunne ikke lagre bulk-valg.", detail: uErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated: targets.length,
      dates: targets,
      skippedLocked,
      skippedNotAllowed,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Uventet feil.", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
