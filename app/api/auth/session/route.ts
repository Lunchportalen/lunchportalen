// app/api/auth/session/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseRoute } from "@/lib/supabase/route";

function copySetCookie(from: NextResponse, to: NextResponse) {
  // Next 15: getSetCookie() finnes i runtime, men TS kan mangle typen.
  const anyFrom: any = from;
  const setCookies: string[] | undefined = typeof anyFrom.headers.getSetCookie === "function"
    ? anyFrom.headers.getSetCookie()
    : undefined;

  if (setCookies?.length) {
    for (const c of setCookies) to.headers.append("set-cookie", c);
  }
  return to;
}

export async function POST(req: Request) {
  const rid = makeRid();
  const body = await req.json().catch(() => ({}));
  const access_token = String(body?.access_token ?? "");
  const refresh_token = String(body?.refresh_token ?? "");

  if (!access_token || !refresh_token) {
    return jsonErr(rid, "Mangler access_token/refresh_token", 400, "BAD_INPUT");
  }

  // NextResponse (not plain Response) so `supabaseRoute` can attach SSR Set-Cookie headers.
  // Re-wrap `jsonOk` so body/headers match enterprise contract while staying a NextResponse.
  const baseOk = jsonOk(rid, {});
  const res = new NextResponse(baseOk.body, {
    status: baseOk.status,
    headers: new Headers(baseOk.headers),
  });

  const supabase = supabaseRoute(req, res);

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return copySetCookie(res, jsonErr(rid, error.message, 401, "SESSION_SET_FAILED") as NextResponse);
  }

  return res;
}
