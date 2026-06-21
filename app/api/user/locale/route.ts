export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, scopeOr401 } from "@/lib/http/routeGuard";
import { APP_LOCALES, parseAppLocale, type AppLocale } from "@/lib/i18n/middlewareLocale";
import { supabaseServer } from "@/lib/supabase/server";

type LocaleBody = { locale?: unknown };

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && APP_LOCALES.includes(value as AppLocale);
}

/**
 * POST: persist UI locale preference for authenticated user.
 * Cookie is set client-side; this route stores profiles.preferred_locale only.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);

  const rid = gate.ctx.rid || makeRid("user_locale");
  const uid = gate.ctx.scope.userId;
  if (!uid) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
  }

  const body = (await readJson(req)) as LocaleBody | null;
  const requested = body?.locale;
  if (!isAppLocale(requested)) {
    return jsonErr(rid, "Ugyldig locale.", 422, "INVALID_LOCALE", {
      allowed: [...APP_LOCALES],
    });
  }

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("profiles")
      .update({ preferred_locale: requested })
      .eq("id", uid)
      .select("preferred_locale")
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke lagre språkpreferanse.", 503, "LOCALE_SAVE_FAILED");
    }

    const saved = parseAppLocale((data as { preferred_locale?: string | null } | null)?.preferred_locale) ?? requested;
    return jsonOk(rid, { locale: saved }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(
      rid,
      "Kunne ikke lagre språkpreferanse.",
      500,
      "LOCALE_SAVE_FAILED",
      process.env.NODE_ENV !== "production" ? { message: msg } : undefined,
    );
  }
}
