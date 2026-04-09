// app/api/something/route.ts
// Contract smoke / internal demo handler — kept for api-contract tooling references.
// H1: ikke åpen uten autentisering — superadmin-session eller CRON_SECRET (Bearer / x-cron-secret).
// No product callers in-repo; prefer explicit domain routes for new work.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { handleSomething, type SomethingFailure } from "@/lib/http/something";

type Body = {
  userId?: string;
  payload?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function ok(rid: string, data?: unknown, status = 200) {
  return NextResponse.json({ ok: true, rid, data }, { status });
}

function err(rid: string, error: string, message: string, status = 400, data?: unknown) {
  return NextResponse.json({ ok: false, rid, error, message, status, data }, { status });
}

function isCronStyleAttempt(req: NextRequest): boolean {
  const auth = String(req.headers.get("authorization") ?? "").trim();
  const x = String(req.headers.get("x-cron-secret") ?? "").trim();
  return auth.toLowerCase().startsWith("bearer ") || x.length > 0;
}

/** Machine (CRON_SECRET) eller innlogget superadmin — fail-closed ellers. */
async function requireSomethingAccess(req: NextRequest): Promise<Response | null> {
  const rid = makeRid();
  const cronSecret = String(process.env.CRON_SECRET ?? "").trim();

  if (cronSecret && isCronStyleAttempt(req)) {
    try {
      requireCronAuth(req);
      return null;
    } catch (e: unknown) {
      const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : "";
      if (code === "forbidden") {
        return err(rid, "FORBIDDEN", "Ugyldig cron-autentisering.", 403);
      }
      if (code === "cron_secret_missing") {
        return err(rid, "MISCONFIGURED", "CRON_SECRET er ikke satt.", 500);
      }
      throw e;
    }
  }

  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  return null;
}

export async function POST(req: NextRequest) {
  const access = await requireSomethingAccess(req);
  if (access) return access;

  const rid = makeRid();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err(rid, "BAD_JSON", "Ugyldig JSON i request body.", 400);
  }

  const userId = safeStr(body?.userId);
  const payload = body?.payload;

  if (!userId) {
    return err(rid, "BAD_REQUEST", "Mangler userId.", 400);
  }

  try {
    const result = await handleSomething({ userId, payload });

    if (result.ok) {
      return ok(rid, result.data, 200);
    }

    const failure = result as SomethingFailure;
    return err(rid, safeStr(failure.code) || "SOMETHING_FAILED", failure.error, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : safeStr(e);
    return err(rid, "INTERNAL_ERROR", msg || "Ukjent feil.", 500);
  }
}
