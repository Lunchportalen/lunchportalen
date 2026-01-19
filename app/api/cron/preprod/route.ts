// app/api/cron/preprod/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireCronAuth(req: Request) {
  // ✅ Vercel cron i ditt oppsett: ?key=${CRON_SECRET}
  const url = new URL(req.url);
  const got = url.searchParams.get("key") || "";
  const want = process.env.CRON_SECRET || "";
  return Boolean(want && got === want);
}

function log(scope: string, payload: any) {
  try {
    console.log(`[cron:${scope}]`, payload);
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

  log("preprod:start", { date: today });

  const { data, error } = await supabase.rpc("lp_generate_signals_for_date", { p_date: today });

  if (error) {
    log("preprod:error", { date: today, message: error.message });

    // ✅ enterprise: logg cron-run
    await supabase.from("cron_runs").insert({
      job: "preprod",
      status: "error",
      detail: error.message,
      meta: { date: today },
    });

    return NextResponse.json({ ok: false, error: error.message, date: today }, { status: 500 });
  }

  const upserted = data ?? 0;

  // ✅ enterprise: logg cron-run
  await supabase.from("cron_runs").insert({
    job: "preprod",
    status: "ok",
    meta: { date: today, signals_upserted: upserted },
  });

  log("preprod:done", { date: today, signals_upserted: upserted });

  return NextResponse.json({ ok: true, date: today, signals_upserted: upserted });
}
