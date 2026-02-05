// app/api/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAfterCutoff0800, osloTodayISODate } from "@/lib/date/oslo";

function versionFromEnv() {
  return (
    process.env.APP_VERSION ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    "unknown"
  );
}

export async function GET() {
  const rid = makeRid();
  const ts = new Date().toISOString();
  const version = versionFromEnv();

  const appOk = true;
  let supabaseOk = false;
  let dbSchemaOk = false;
  let ordersOk = false;
  let profilesOk = false;
  let sanityOk = false;
  let failureRid: string | null = null;

  try {
    const sb = supabaseAdmin();

    const supa = await sb.from("profiles").select("id").limit(1);
    supabaseOk = !supa.error;

    const [p, o] = await Promise.all([
      sb.from("profiles").select("id").limit(1),
      sb.from("orders").select("id").limit(1),
    ]);
    profilesOk = !p.error;
    ordersOk = !o.error;
    dbSchemaOk = profilesOk && ordersOk;
  } catch {
    supabaseOk = false;
    dbSchemaOk = false;
    profilesOk = false;
    ordersOk = false;
  }

  try {
    // sanity: cutoff / timezone helper must run without exceptions
    const _today = osloTodayISODate();
    const _after = isAfterCutoff0800();
    sanityOk = Boolean(_today) && typeof _after === "boolean";
  } catch {
    sanityOk = false;
  }

  const ok = Boolean(appOk && supabaseOk && dbSchemaOk && sanityOk);
  if (!ok) failureRid = makeRid();

  const body = {
    ok,
    ts,
    version,
    ...(failureRid ? { rid: failureRid } : {}),
    checks: {
      app: { ok: appOk },
      supabase: { ok: supabaseOk },
      db_schema: { ok: dbSchemaOk, orders: { ok: ordersOk }, profiles: { ok: profilesOk } },
      sanity: { ok: sanityOk, cutoff_helpers: { ok: sanityOk } },
    },
  };

  if (!ok) {
    return jsonErr(rid, "Health check failed.", 503, { code: "HEALTH_FAILED", detail: body });
  }

  return jsonOk(rid, body, 200);
}
