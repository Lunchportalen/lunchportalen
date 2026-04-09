export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getAutonomyEnvConfig } from "@/lib/autonomy/config";
import { loadAutonomyOverride, mergeAutonomyConfig, persistAutonomyOverride } from "@/lib/autonomy/override";
import type { AutonomyMode } from "@/lib/autonomy/types";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { superadminAutonomyConfigBodySchema } from "@/lib/validation/schemas";
import { parseValidatedJson } from "@/lib/validation/withValidation";

function parseMode(v: unknown): AutonomyMode | undefined {
  if (v === "dry-run" || v === "semi" || v === "auto") return v;
  return undefined;
}

/**
 * GET: effektiv autonomi-konfig (env + siste override i audit-logg).
 * POST: lagre override (superadmin) — ikke env-variabler, men neste kjøringer leser dette.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("superadmin_autonomy_get");
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Database utilgjengelig.", 503, "DB_UNAVAILABLE");
  }

  try {
    const admin = supabaseAdmin();
    const envCfg = getAutonomyEnvConfig();
    const override = await loadAutonomyOverride(admin);
    const merged = mergeAutonomyConfig(envCfg, override);
    return jsonOk(
      rid,
      {
        config: merged,
        env: envCfg,
        override,
      },
      200
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "AUTONOMY_CONFIG_FAILED");
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("superadmin_autonomy_post");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Database utilgjengelig.", 503, "DB_UNAVAILABLE");
  }

  return runInstrumentedApi(req, { rid, route: "/api/superadmin/autonomy" }, async () => {
    try {
      const parsed = await parseValidatedJson(superadminAutonomyConfigBodySchema, req, rid);
      if (parsed.ok === false) return parsed.response;

      const body = parsed.data;
      const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
      const mode = parseMode(body.mode);

      const admin = supabaseAdmin();
      const r = await persistAutonomyOverride(admin, { rid, enabled, mode });
      if (r.ok === false) {
        return jsonErr(rid, r.error, 500, "AUTONOMY_PERSIST_FAILED");
      }

      const envCfg = getAutonomyEnvConfig();
      const override = await loadAutonomyOverride(admin);
      const merged = mergeAutonomyConfig(envCfg, override);

      return jsonOk(rid, { config: merged }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonErr(rid, msg, 500, "AUTONOMY_CONFIG_FAILED");
    }
  });
}
