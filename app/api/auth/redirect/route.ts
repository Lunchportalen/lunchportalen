// app/api/auth/redirect/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { resolvePostLoginTargetForAuth, sanitizePostLoginNextPath } from "@/lib/auth/role";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/* =========================================================
   Route
========================================================= */

export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const url = new URL(req.url);
    const nextSafe = sanitizePostLoginNextPath(url.searchParams.get("next"));
    const auth = await getAuthContext({ rid, reqHeaders: req.headers });

    if (auth.reason === "UNAUTHENTICATED") {
      const loginUrl = new URL("/login", url.origin);
      if (nextSafe) loginUrl.searchParams.set("next", nextSafe);
      const res = jsonOk(rid, { ok: true, target: loginUrl.toString() }, 303);
      res.headers.set("Location", loginUrl.toString());
      return res;
    }

    const target = resolvePostLoginTargetForAuth({
      role: auth.role,
      email: auth.email,
      nextPath: nextSafe,
    });
    const to = new URL(target, url.origin);
    const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
    res.headers.set("Location", to.toString());
    return res;
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke fullføre redirect.", 500, { code: "REDIRECT_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
