// app/api/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAfterCutoff0800, osloTodayISODate } from "@/lib/date/oslo";
import { validateSystemRuntimeEnv } from "@/lib/env/system";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { releaseIdentityRequired, resolveReleaseIdentity } from "@/lib/version/releaseIdentity";

export async function GET() {
  const rid = makeRid();
  const ts = new Date().toISOString();
  const release = resolveReleaseIdentity();
  const versionRequired = releaseIdentityRequired();
  const versionOk = release.ok;
  const version = release.ok ? release.version : "";
  const cmsRuntime = getCmsRuntimeStatus();

  const appOk = true;
  let remoteConfigured = true;
  let remoteSupabaseOk = false;
  let dbSchemaOk = false;
  let ordersOk = false;
  let profilesOk = false;
  let sanityOk = false;
  let remoteError: string | null = null;
  let failureRid: string | null = null;
  const envReport = validateSystemRuntimeEnv();
  const envOk = envReport.ok;

  try {
    const sb = supabaseAdmin();

    const supa = await sb.from("profiles").select("id").limit(1);
    remoteSupabaseOk = !supa.error;

    const [p, o] = await Promise.all([
      sb.from("profiles").select("id").limit(1),
      sb.from("orders").select("id").limit(1),
    ]);
    profilesOk = !p.error;
    ordersOk = !o.error;
    dbSchemaOk = profilesOk && ordersOk;
  } catch (error) {
    remoteSupabaseOk = false;
    dbSchemaOk = false;
    profilesOk = false;
    ordersOk = false;
    const message = error instanceof Error ? error.message : String(error);
    remoteError = message || "Ukjent remote-feil";
    if ((error as { code?: string })?.code === "CONFIG_ERROR") {
      remoteConfigured = false;
    }
  }

  try {
    // sanity: cutoff / timezone helper must run without exceptions
    const _today = osloTodayISODate();
    const _after = isAfterCutoff0800();
    sanityOk = Boolean(_today) && typeof _after === "boolean";
  } catch {
    sanityOk = false;
  }

  const remoteHealthy = Boolean(remoteConfigured && remoteSupabaseOk && dbSchemaOk);
  const sanityHealthy = Boolean(sanityOk);
  const envHealthy = Boolean(envOk);
  const versionHealthy = !versionRequired || versionOk;
  const remoteSummaryStatus: "ok" | "degraded" | "failed" | "skipped" =
    !remoteConfigured
      ? cmsRuntime.requiresRemoteBackend
        ? "failed"
        : "skipped"
      : remoteHealthy
        ? "ok"
        : cmsRuntime.requiresRemoteBackend
          ? "failed"
          : "degraded";

  let summaryStatus: "ok" | "degraded" | "failed" = "ok";
  if (!envHealthy || !versionHealthy) {
    summaryStatus = "failed";
  } else if (cmsRuntime.requiresRemoteBackend && remoteSummaryStatus !== "ok") {
    summaryStatus = "failed";
  } else if (!sanityHealthy || cmsRuntime.mode === "reserve") {
    summaryStatus = "degraded";
  }

  const ok = summaryStatus === "ok";
  if (!ok) failureRid = makeRid();

  const body = {
    ok,
    ts,
    version,
    release: {
      ok: versionOk,
      required: versionRequired,
      source: release.source,
      git_sha: release.gitSha,
    },
    ...(failureRid ? { rid: failureRid } : {}),
    summary: {
      status: summaryStatus,
      runtime: cmsRuntime.mode,
      remote_backend: remoteSummaryStatus,
      supabase: remoteSummaryStatus,
      sanity: sanityHealthy ? "ok" : "degraded",
      env: envHealthy ? "ok" : "failed",
      timestamp: ts,
    },
    checks: {
      app: { ok: appOk },
      runtime: {
        ok: true,
        mode: cmsRuntime.mode,
        source: cmsRuntime.source,
        explicit: cmsRuntime.explicit,
        requiresRemoteBackend: cmsRuntime.requiresRemoteBackend,
      },
      supabase: {
        ok: remoteHealthy,
        configured: remoteConfigured,
        required: cmsRuntime.requiresRemoteBackend,
        status: remoteSummaryStatus,
        error: remoteError,
      },
      db_schema: { ok: dbSchemaOk, orders: { ok: ordersOk }, profiles: { ok: profilesOk } },
      sanity: { ok: sanityOk, cutoff_helpers: { ok: sanityOk } },
      env: envReport,
      release_identity: {
        ok: versionHealthy,
        required: versionRequired,
        source: release.source,
      },
    },
  };

  if (!ok) {
    return jsonErr(rid, "Health check failed.", 503, "HEALTH_FAILED", body);
  }

  return jsonOk(rid, body, 200);
}
