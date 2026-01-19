// app/api/cron/forecast/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireCronAuth(req: Request) {
  // ✅ Vercel crons i ditt oppsett bruker ?key=${CRON_SECRET}
  const url = new URL(req.url);
  const got = url.searchParams.get("key") || "";
  const want = process.env.CRON_SECRET || "";
  return Boolean(want && got === want);
}

function addDaysISO(dateISO: string, days: number) {
  // dateISO er Oslo-dato (YYYY-MM-DD). Vi holder oss til lokal dag, ikke UTC.
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function log(scope: string, payload: any) {
  try {
    console.log(`[cron:${scope}]`, payload);
  } catch {
    // no-op
  }
}

async function logCronRun(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  payload: { status: "ok" | "error"; detail?: string | null; meta?: Record<string, any> }
) {
  // ✅ enterprise: cron_runs kan feile hvis RLS/DB er midlertidig; vi lar ikke cron dø av logging
  try {
    await supabase.from("cron_runs").insert({
      job: "forecast",
      status: payload.status,
      detail: payload.detail ?? null,
      meta: payload.meta ?? {},
    });
  } catch {
    // no-op
  }
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await supabaseServer();

  const today = osloTodayISODate();
  const fromDefault = today;
  const toDefault = addDaysISO(today, 13); // 14 dager inkl. i dag

  // Optional overrides via query params (for testing)
  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");
  const modelQ = url.searchParams.get("model") || "v1";

  const fromFinal = fromQ?.match(/^\d{4}-\d{2}-\d{2}$/) ? fromQ : fromDefault;
  const toFinal = toQ?.match(/^\d{4}-\d{2}-\d{2}$/) ? toQ : toDefault;

  log("forecast:start", { from: fromFinal, to: toFinal, model: modelQ });

  const { data, error } = await supabase.rpc("lp_generate_forecast_range", {
    p_from: fromFinal,
    p_to: toFinal,
    p_model_version: modelQ,
  });

  if (error) {
    log("forecast:error", { message: error.message, from: fromFinal, to: toFinal, model: modelQ });

    await logCronRun(supabase, {
      status: "error",
      detail: error.message,
      meta: { from: fromFinal, to: toFinal, model: modelQ },
    });

    return NextResponse.json(
      { ok: false, error: error.message, from: fromFinal, to: toFinal, model: modelQ },
      { status: 500 }
    );
  }

  const upserts = data ?? 0;

  await logCronRun(supabase, {
    status: "ok",
    meta: { from: fromFinal, to: toFinal, model: modelQ, upserts },
  });

  log("forecast:done", { upserts, from: fromFinal, to: toFinal, model: modelQ });

  return NextResponse.json({
    ok: true,
    from: fromFinal,
    to: toFinal,
    model: modelQ,
    upserts,
  });
}
