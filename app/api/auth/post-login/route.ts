// app/api/auth/post-login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { trackEvent } from "@/lib/experiments/tracker";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import {
  allowNextForRole,
  normalizeRole,
  sanitizePostLoginNextPath,
  type Role,
} from "@/lib/auth/role";
import { resolveLoginDestination } from "@/lib/auth/resolveLoginDestination";
import { supabaseServer } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { makeRid } from "@/lib/http/respond";
import { SYSTEM_EMAILS, normEmail } from "@/lib/system/emails";
import type { Database } from "@/lib/types/database";
import { observeResponse } from "@/lib/observability/eventLogger";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function readLpExpCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): { experimentId: string; variantId: string } | null {
  const raw = cookieStore.get("lp_exp")?.value;
  if (!raw) return null;
  const tryParse = (s: string) => {
    try {
      const j = JSON.parse(s) as { experimentId?: unknown; variantId?: unknown };
      const experimentId = safeStr(j.experimentId);
      const variantId = safeStr(j.variantId);
      if (!experimentId || !variantId) return null;
      return { experimentId, variantId };
    } catch {
      return null;
    }
  };
  return tryParse(decodeURIComponent(raw)) ?? tryParse(raw);
}

function pickRid(req: NextRequest) {
  return safeStr(req.nextUrl.searchParams.get("rid")) || makeRid();
}

function authLog(step: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  // eslint-disable-next-line no-console
  console.info("[auth]", { step, ...data });
}

function loginRedirect(req: NextRequest, rid: string, code: string) {
  const u = new URL("/login", req.nextUrl.origin);
  u.searchParams.set("code", code);
  u.searchParams.set("rid", rid);
  return NextResponse.redirect(u, { status: 303 });
}

/**
 * Lightweight presence check: does this company have an ACTIVE agreement?
 * Uses the request-bound SSR client (RLS-scoped). On any DB error we
 * fail closed (false) — caller will land on /avtale-ikke-aktiv, which is
 * the same destination the /admin or /week guard would produce anyway.
 */
async function lookupHasActiveAgreement(companyId: string | null, rid: string): Promise<boolean> {
  if (!companyId) return false;
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("agreements")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();
    if (error) {
      opsLog("auth.post_login.agreement_lookup_failed", {
        rid,
        company_id: companyId,
        error: safeStr((error as { message?: string }).message) || "UNKNOWN",
      });
      return false;
    }
    return Boolean(data?.id);
  } catch (e) {
    opsLog("auth.post_login.agreement_lookup_exception", {
      rid,
      company_id: companyId,
      message: safeStr((e as Error)?.message) || "UNKNOWN",
    });
    return false;
  }
}

export async function POST(req: Request) {
  const rid = makeRid();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, rid, error: "BAD_JSON", message: "Ugyldig JSON.", status: 400 },
      { status: 400 }
    );
  }

  const access_token = safeStr((body as { access_token?: unknown })?.access_token);
  const refresh_token = safeStr((body as { refresh_token?: unknown })?.refresh_token);

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { ok: false, rid, error: "NO_TOKENS", message: "Mangler tokens.", status: 400 },
      { status: 400 }
    );
  }

  return observeResponse(
    {
      type: "auth.post_login.POST",
      source: "/api/auth/post-login",
      rid,
      metadata: { method: "POST" },
    },
    async () => {
      const cookieStore = await cookies();
      let supabaseUrl: string;
      let supabaseAnon: string;
      try {
        const pub = getSupabasePublicConfig();
        supabaseUrl = pub.url;
        supabaseAnon = pub.anonKey;
      } catch {
        return NextResponse.json(
          { ok: false, rid, error: "MISSING_ENV", message: "Serverkonfigurasjon mangler.", status: 503 },
          { status: 503 }
        );
      }

      // Canonical session: `setSession` + SSR cookie adapter (same model as login + middleware refresh).
      const sb = createServerClient<Database>(supabaseUrl, supabaseAnon, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              try {
                cookieStore.set(name, value, options);
              } catch {
                /* non-fatal */
              }
            }
          },
        },
      });

      const { error } = await sb.auth.setSession({ access_token, refresh_token });
      if (error) {
        return NextResponse.json(
          {
            ok: false,
            rid,
            error: "SET_SESSION_FAILED",
            message: safeStr(error.message) || "Kunne ikke etablere sesjon.",
            status: 400,
          },
          { status: 400 }
        );
      }

      const headerExperiment = safeStr(req.headers.get("x-experiment-id"));
      const headerVariant = safeStr(req.headers.get("x-variant-id"));
      const bodyExperiment = safeStr((body as { experimentId?: unknown }).experimentId);
      const bodyVariant = safeStr(
        (body as { experimentVariantId?: unknown }).experimentVariantId ?? (body as { variantId?: unknown }).variantId,
      );
      const fromCookie = readLpExpCookie(cookieStore);
      const experimentId = headerExperiment || bodyExperiment || fromCookie?.experimentId || "";
      const variantId = headerVariant || bodyVariant || fromCookie?.variantId || "";

      let conversionRecordedViaTracker = false;
      if (experimentId && variantId && isUuid(experimentId)) {
        const { data: userData } = await sb.auth.getUser();
        const userUuid = userData.user?.id ?? null;
        const out = await trackEvent({
          experimentId,
          variantId,
          eventType: "conversion",
          userId: userUuid,
        });
        conversionRecordedViaTracker = out.ok;
        opsLog("growth.post_login_conversion", {
          rid,
          experimentId,
          variantId,
          recorded: out.ok,
          error: out.ok === false ? out.error : undefined,
        });
        if (out.ok === false) {
          try {
            const trackUrl = new URL("/api/public/track-event", req.url).toString();
            const res = await fetch(trackUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(headerExperiment && headerVariant
                  ? { "x-experiment-id": headerExperiment, "x-variant-id": headerVariant }
                  : {}),
              },
              body: JSON.stringify({
                experimentId,
                variantId,
                type: "conversion",
                ...(userUuid ? { userId: userUuid } : {}),
              }),
            });
            if (!res.ok) {
              // eslint-disable-next-line no-console -- growth failsafe visibility
              console.warn("tracking_failed_conversion", res.status);
            }
          } catch {
            // eslint-disable-next-line no-console -- growth failsafe visibility
            console.warn("tracking_failed_conversion");
          }
        }
      } else if (experimentId || variantId) {
        opsLog("growth.post_login_conversion_skip", {
          rid,
          reason: "invalid_or_partial_pair",
          experimentId: experimentId || null,
          variantId: variantId || null,
        });
      }

      try {
        const baseUrl = safeStr(process.env.NEXT_PUBLIC_BASE_URL).replace(/\/$/, "");
        const variantIdH = safeStr(req.headers.get("x-variant-id"));
        const experimentIdH = safeStr(req.headers.get("x-experiment-id"));
        if (variantIdH && experimentIdH && baseUrl && !conversionRecordedViaTracker) {
          await fetch(`${baseUrl}/api/public/track-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variantId: variantIdH,
              experimentId: experimentIdH,
              type: "conversion",
            }),
          });
        }
      } catch {
        /* must not fail login */
      }

      return NextResponse.json({ ok: true, rid, data: {} });
    },
  );
}

export async function GET(req: NextRequest) {
  const rid = pickRid(req);

  return observeResponse(
    {
      type: "auth.post_login.GET",
      source: "/api/auth/post-login",
      rid,
      metadata: { method: "GET" },
    },
    async () => {
      const nextSafe = sanitizePostLoginNextPath(req.nextUrl.searchParams.get("next"));

      let auth: Awaited<ReturnType<typeof getAuthContext>>;
      try {
        auth = await getAuthContext({ rid });
      } catch (e) {
        const message = safeStr((e as Error)?.message) || "EXCEPTION";
        opsLog("auth.post_login.exception", { rid, message });
        console.error("[POST-LOGIN-AUTH-FAIL]", {
          rid,
          reason: "EXCEPTION",
          userId: null,
          hasUser: false,
          redirectTo: "/login?code=AUTH_ERROR",
          message,
        });
        return loginRedirect(req, rid, "AUTH_ERROR");
      }

      if (!auth.ok) {
        const reason = auth.reason;
        const userId = auth.userId;
        const hasUser = Boolean(userId);

        let code: string;
        switch (reason) {
          case "UNAUTHENTICATED":
            code = "NO_SESSION";
            break;
          case "NO_PROFILE":
            code = "NO_PROFILE";
            break;
          case "BLOCKED":
            code = "BLOCKED";
            break;
          case "ERROR":
          default:
            code = "AUTH_ERROR";
            opsLog("auth.post_login.error", { rid, reason, userId, hasUser });
            break;
        }

        const redirectTo = `/login?code=${code}&rid=${rid}`;
        // Permanent debug log: surfaces which auth.reason actually fired in
        // the Vercel log so we can distinguish NO_PROFILE vs BLOCKED vs ERROR.
        console.error("[POST-LOGIN-AUTH-FAIL]", { rid, reason, userId, hasUser, redirectTo });
        authLog("post-login:get", { rid, reason, userId, hasUser, code });
        return loginRedirect(req, rid, code);
      }

      // auth.ok = true — resolve via canonical mapper.
      const email = normEmail(auth.email);
      const role = normalizeRole(auth.role);

      // System mailbox stays special-cased; not a role-based destination.
      if (email && email === SYSTEM_EMAILS.ORDER) {
        const to = new URL("/outbox", req.nextUrl.origin);
        to.searchParams.set("rid", rid);
        console.error("[POST-LOGIN-RESOLVED]", {
          rid,
          userId: auth.userId,
          resolvedRole: role,
          hasActiveAgreement: null,
          baseDest: "/outbox",
          redirectTo: to.pathname + to.search,
        });
        return NextResponse.redirect(to, { status: 303 });
      }

      // Roles that require an active agreement: company_admin, finance, location-admin, employee.
      const roleNeedsAgreement =
        role === "company_admin" ||
        role === "company_finance" ||
        role === "location_admin" ||
        role === "employee";
      const hasActiveAgreement = roleNeedsAgreement
        ? await lookupHasActiveAgreement(auth.company_id, rid)
        : true;

      const baseDest = resolveLoginDestination({ role, hasActiveAgreement });

      // Honor a safe `next=` only when no agreement gate is triggered and role is resolved.
      let dest = baseDest;
      const blockedDest = baseDest === "/avtale-ikke-aktiv" || baseDest.startsWith("/login?");
      if (nextSafe && !blockedDest && role) {
        const allowed = allowNextForRole(role as Role, nextSafe);
        if (allowed) dest = allowed;
      }

      const to = new URL(dest, req.nextUrl.origin);
      to.searchParams.set("rid", rid);

      // Permanent debug log: records every successful resolution with the
      // pieces needed to reconstruct routing decisions in Vercel logs.
      console.error("[POST-LOGIN-RESOLVED]", {
        rid,
        userId: auth.userId,
        resolvedRole: role,
        hasActiveAgreement,
        baseDest,
        nextRequested: nextSafe,
        redirectTo: to.pathname + to.search,
      });
      authLog("post-login:get", { rid, role, hasActiveAgreement, target: dest });

      return NextResponse.redirect(to, { status: 303 });
    },
  );
}
