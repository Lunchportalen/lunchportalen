export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

void jsonOk;

export async function POST(req: NextRequest) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.create", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;
  return jsonErr(
    rid,
    "Manuell opprettelse av agreement-utkast er ikke lenger tillatt. Avtaler opprettes nå automatisk når en pending company_registration godkjennes. Se /superadmin/registrations.",
    410,
    "FLOW_DEPRECATED"
  );
}

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-rid") || "rid_missing";
  return jsonErr(rid, "Bruk POST.", 405, "METHOD_NOT_ALLOWED");
}
