export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function hasValidBootstrapToken(req: NextRequest) {
  const expected = safeStr(process.env.ONBOARDING_CREATE_ADMIN_TOKEN);
  if (!expected) return false;

  const fromHeader = safeStr(req.headers.get("x-onboarding-create-admin-token"));
  if (!fromHeader) return false;

  return timingSafeEqual(fromHeader, expected);
}

function accepted(rid: string) {
  return jsonOk(rid, {
    message: "Forespørselen er mottatt.",
  }, 202);
}

export async function POST(req: NextRequest) {
  const rid = makeRid("rid_create_admin");

  if (hasValidBootstrapToken(req)) {
    return accepted(rid);
  }

  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "public.onboarding.create-admin", ["superadmin"]);
  if (deny) return deny;

  return accepted(g.ctx.rid);
}

export async function GET(req: NextRequest) {
  const rid = makeRid("rid_create_admin_get");
  return jsonErr(rid, "Bruk POST for denne handlingen.", 405, "METHOD_NOT_ALLOWED");
}
