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
import { resolvePostLoginTargetForAuth, sanitizePostLoginNextPath } from "@/lib/auth/role";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { makeRid } from "@/lib/http/respond";
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
      try {
        const nextSafe = sanitizePostLoginNextPath(req.nextUrl.searchParams.get("next"));
        // Use this request's Cookie header so session matches immediately after login navigation
        // (avoids edge cases where cookies() lags the incoming GET).
        const auth = await getAuthContext({ rid, reqHeaders: req.headers });

        if (!auth.ok) {
          if (auth.reason === "UNAUTHENTICATED") {
            authLog("post-login:get", { rid, error: "NO_SESSION" });
            return loginRedirect(req, rid, "NO_SESSION");
          }

          const blocked = new URL("/week", req.nextUrl.origin);
          blocked.searchParams.set("rid", rid);
          return NextResponse.redirect(blocked, { status: 303 });
        }

        const target = resolvePostLoginTargetForAuth({
          role: auth.role,
          email: auth.email,
          nextPath: nextSafe,
        });

        authLog("post-login:get", { rid, role: auth.role, target });

        const to = new URL(target, req.nextUrl.origin);
        to.searchParams.set("rid", rid);
        return NextResponse.redirect(to, { status: 303 });
      } catch (e) {
        authLog("post-login:get", { rid, error: safeStr((e as Error)?.message) || "NO_SESSION" });
        return loginRedirect(req, rid, "NO_SESSION");
      }
    },
  );
}
