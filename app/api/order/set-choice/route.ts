// app/api/order/set-choice/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  date: string; // YYYY-MM-DD
  choice_key: string; // f.eks. "salatbar", "varmmat"
  note?: string; // valgfri
};

type Choice = { key: string; label?: string };
type CompanyStatus = "active" | "paused" | "closed";

/* =========================
   DB-typer lokalt (for å stoppe TS "never")
========================= */
type ProfileRow = {
  user_id: string;
  company_id: string | null;
  location_id: string | null;
  role?: string | null;
};

type CompanyRow = {
  id: string;
  status?: CompanyStatus | null;
  paused_reason?: string | null;
  closed_reason?: string | null;

  contract_week_tier: Record<string, "BASIS" | "PREMIUM"> | null;
  contract_basis_choices: Choice[] | null;
  contract_premium_choices: Choice[] | null;
};

type DayChoiceUpsert = {
  company_id: string;
  location_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  choice_key: string;
  note: string | null;
  status: string; // "ACTIVE"
};

type DayChoiceSelect = {
  id: string;
  date: string;
  choice_key: string;
  note: string | null;
  status: string | null;
  updated_at: string | null;
};

function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

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

  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  // Midday UTC for stable weekday calc
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(d);

  const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
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

function cleanNote(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.length > 280 ? s.slice(0, 280) : s;
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
      // Route handlers trenger normalt ikke å sette cookies
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

// ✅ Service role client (cachet)
let _svc: ReturnType<typeof createClient> | null = null;
function supabaseService() {
  if (_svc) return _svc;

  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

  _svc = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "lunchportalen-order-set-choice" } },
  });

  return _svc;
}

/* =========================
   Company status gate (PAUSED/CLOSED)
   - Bruk SupabaseClient<any, any, any> for å unngå TS "public vs never"
========================= */
async function assertCompanyActive(supa: SupabaseClient<any, any, any>, companyId: string) {
  const { data, error } = await (supa as any)
    .from("companies")
    .select("status, paused_reason, closed_reason")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      status: 500,
      error: "COMPANY_LOOKUP_FAILED",
      reason: error?.message ?? "Company lookup failed",
    };
  }

  const status = (data.status ?? "active") as CompanyStatus;

  if (status === "paused") {
    return {
      ok: false as const,
      status: 403,
      error: "COMPANY_PAUSED",
      reason: (data.paused_reason as string | null) ?? "Firma er pauset.",
    };
  }

  if (status === "closed") {
    return {
      ok: false as const,
      status: 403,
      error: "COMPANY_CLOSED",
      reason: (data.closed_reason as string | null) ?? "Firma er stengt.",
    };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  const rid = `setchoice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;

    const date = (body?.date ?? "").trim();
    const choice_key = (body?.choice_key ?? "").trim();
    const note = cleanNote(body?.note);

    // 0) Input validering
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, rid, error: "BAD_DATE", message: "Ugyldig datoformat. Bruk YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (!choice_key) {
      return NextResponse.json(
        { ok: false, rid, error: "MISSING_CHOICE_KEY", message: "choice_key mangler." },
        { status: 400 }
      );
    }

    // 1) Auth (cookie-basert)
    const user_id = await getAuthedUserId();
    if (!user_id) {
      return NextResponse.json(
        { ok: false, rid, error: "UNAUTH", message: "Ikke innlogget." },
        { status: 401 }
      );
    }

    // 2) Cutoff-lås
    const cutoff = cutoffState(date);
    if (cutoff.locked) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "LOCKED",
          message: "Dagen er låst etter 08:00.",
          locked: true,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 423 }
      );
    }

    // 3) Ukedag (Man–Fri)
    let dayKey: "mon" | "tue" | "wed" | "thu" | "fri";
    try {
      dayKey = weekdayKeyOslo(date);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "WEEKDAY_ONLY",
          message: "Dato må være Man–Fre. Helg bestilles ikke i portalen.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 400 }
      );
    }

    // 4) Service role for DB (ingen RLS)
    const supa = supabaseService();

    // 5) Profil -> firma + lokasjon
    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("user_id, company_id, location_id, role")
      .eq("user_id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr) {
      logApiError("POST /api/order/set-choice profile failed", pErr, { rid, user_id, date });
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "PROFILE_LOOKUP_FAILED",
          detail: pErr.message,
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "PROFILE_NOT_FOUND",
          message: "Fant ikke profil.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 403 }
      );
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    if (!company_id || !location_id) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "PROFILE_MISSING_SCOPE",
          message: "Profil mangler company_id/location_id.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 403 }
      );
    }

    // 6) ✅ Company status gate (PAUSED/CLOSED)
    const gate = await assertCompanyActive(supa as any, company_id);
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: gate.error,
          message: gate.reason,
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: gate.status }
      );
    }

    // 7) Hent kontrakt fra companies
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("id, contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    const company = (companyRaw ?? null) as CompanyRow | null;

    if (cErr || !company) {
      logApiError("POST /api/order/set-choice company failed", cErr, { rid, company_id });
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "COMPANY_CONTRACT_NOT_FOUND",
          message: "Fant ikke firma/kontrakt.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 403 }
      );
    }

    const weekTier = company.contract_week_tier;
    if (!weekTier) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "CONTRACT_MISSING_WEEK_TIER",
          message: "Kontrakt mangler contract_week_tier.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 400 }
      );
    }

    const tier = weekTier[dayKey];
    if (!tier) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "CONTRACT_MISSING_DAY_TIER",
          message: "Kontrakt mangler tier-plan for denne dagen.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 400 }
      );
    }

    const allowed = tier === "BASIS" ? company.contract_basis_choices : company.contract_premium_choices;

    if (!Array.isArray(allowed) || allowed.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "CONTRACT_MISSING_CHOICES",
          message: "Kontrakt mangler menyvalg.",
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 400 }
      );
    }

    if (!allowed.some((x) => x?.key === choice_key)) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "INVALID_CHOICE",
          message: `Ugyldig valg for ${tier}-dag.`,
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: false,
        },
        { status: 400 }
      );
    }

    // 8) Upsert til day_choices (idempotent) + receipt
    const payload: DayChoiceUpsert = {
      company_id,
      location_id,
      user_id,
      date,
      choice_key,
      note,
      status: "ACTIVE",
    };

    const { data: savedRaw, error: uErr } = await (supa as any)
      .from("day_choices")
      .upsert(payload, { onConflict: "company_id,location_id,user_id,date" })
      .select("id, date, choice_key, note, status, updated_at")
      .single();

    const saved = (savedRaw ?? null) as DayChoiceSelect | null;

    if (uErr || !saved) {
      logApiError("POST /api/order/set-choice upsert failed", uErr, {
        rid,
        company_id,
        location_id,
        user_id,
        date,
        choice_key,
      });

      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "SAVE_FAILED",
          message: "Kunne ikke lagre valg.",
          detail: uErr?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        rid,

        // ✅ Kvittering 
        receipt: {
          orderId: saved.id,
          status: "ACTIVE",
          date: saved.date,
          updatedAt: saved.updated_at ?? null,
        },

        date: saved.date,
        choice_key: saved.choice_key,
        note: saved.note ?? null,
        tier,
        updated_at: saved.updated_at ?? null,
        locked: false,
        cutoffTime: cutoff.cutoffTime,
        canAct: true,
        scope: { company_id, location_id, user_id },
      },
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("POST /api/order/set-choice failed", e, { rid: "setchoice_unknown" });
    return NextResponse.json(
      { ok: false, rid: "setchoice_unknown", error: "SERVER_ERROR", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
