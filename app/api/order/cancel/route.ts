// app/api/order/cancel/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  date: string; // YYYY-MM-DD
};

type CompanyStatus = "active" | "paused" | "closed";

type ProfileRow = {
  user_id: string;
  company_id: string | null;
  location_id: string | null;
  role?: string | null;
};

type DayChoiceRow = {
  id: string;
  company_id: string;
  location_id: string;
  user_id: string;
  date: string;
  status: string; // "ACTIVE" | "CANCELLED"
  updated_at?: string | null;
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
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    timeHM: `${get("hour")}:${get("minute")}`,
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

// ✅ Service role client (cachet)
let _svc: ReturnType<typeof createClient> | null = null;
function supabaseService() {
  if (_svc) return _svc;

  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

  _svc = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "lunchportalen-order-cancel" } },
  });

  return _svc;
}

/* =========================
   Company status gate (PAUSED/CLOSED)
   - Bruk SupabaseClient<any, any, any> for å unngå TS "public vs never"
   - For cancel: vi blokkerer også for PAUSED/CLOSED (enterprise-stramt).
     Hvis dere vil tillate cancel under PAUSED, endre status === "paused" -> ok.
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
  const rid = `cancel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;
    const date = (body?.date ?? "").trim();

    // 0) Input validering
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, rid, error: "BAD_DATE", message: "Ugyldig datoformat. Bruk YYYY-MM-DD." },
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
    try {
      weekdayKeyOslo(date);
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
      logApiError("POST /api/order/cancel profile failed", pErr, { rid, user_id, date });
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "PROFILE_LOOKUP_FAILED",
          message: "Kunne ikke hente profil.",
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

    // 7) Finn eksisterende day_choice (idempotent)
    const { data: existingRaw, error: eErr } = await (supa as any)
      .from("day_choices")
      .select("id, company_id, location_id, user_id, date, status, updated_at")
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .eq("user_id", user_id)
      .eq("date", date)
      .maybeSingle();

    const existing = (existingRaw ?? null) as DayChoiceRow | null;

    if (eErr) {
      logApiError("POST /api/order/cancel read existing failed", eErr, {
        rid,
        company_id,
        location_id,
        user_id,
        date,
      });
      return NextResponse.json(
        { ok: false, rid, error: "READ_FAILED", message: "Kunne ikke lese eksisterende valg.", detail: eErr.message },
        { status: 500 }
      );
    }

    if (!existing) {
      // Idempotent: ingen rad å kansellere
      return NextResponse.json(
        {
          ok: true,
          rid,
          cancelled: false,
          alreadyCancelled: false,
          message: "Ingen bestilling å avbestille for denne dagen.",
          date,
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: true,
          scope: { company_id, location_id, user_id },
        },
        { status: 200 }
      );
    }

    const statusUpper = String(existing.status ?? "").toUpperCase();
    if (statusUpper === "CANCELLED") {
      // Idempotent: allerede kansellert
      return NextResponse.json(
        {
          ok: true,
          rid,
          cancelled: false,
          alreadyCancelled: true,
          message: "Allerede avbestilt.",
          date,
          receipt: {
            orderId: existing.id,
            status: "CANCELLED",
            date,
            updatedAt: existing.updated_at ?? null,
          },
          updated_at: existing.updated_at ?? null,
          locked: false,
          cutoffTime: cutoff.cutoffTime,
          canAct: true,
          scope: { company_id, location_id, user_id },
        },
        { status: 200 }
      );
    }

    // 8) Marker som CANCELLED (behold rad)
    const { data: updatedRaw, error: uErr } = await (supa as any)
      .from("day_choices")
      .update({ status: "CANCELLED" })
      .eq("id", existing.id)
      .select("id, date, status, updated_at")
      .single();

    if (uErr || !updatedRaw) {
      logApiError("POST /api/order/cancel update failed", uErr, { rid, existingId: existing.id });
      return NextResponse.json(
        { ok: false, rid, error: "CANCEL_FAILED", message: "Kunne ikke avbestille.", detail: uErr?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        rid,
        cancelled: true,
        alreadyCancelled: false,
        date,
        status: (updatedRaw as any).status,
        receipt: {
          orderId: (updatedRaw as any).id,
          status: "CANCELLED",
          date: (updatedRaw as any).date,
          updatedAt: (updatedRaw as any).updated_at ?? null,
        },
        updated_at: (updatedRaw as any).updated_at ?? null,
        locked: false,
        cutoffTime: cutoff.cutoffTime,
        canAct: true,
        scope: { company_id, location_id, user_id },
      },
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("POST /api/order/cancel failed", e, { rid: "cancel_unknown" });
    return NextResponse.json(
      { ok: false, rid: "cancel_unknown", error: "SERVER_ERROR", message: "Uventet feil.", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
