// app/api/auth/session/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
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
  const body = await req.json().catch(() => ({}));
  const access_token = String(body?.access_token ?? "");
  const refresh_token = String(body?.refresh_token ?? "");

  // ✅ Én response som Supabase får lov å sette cookies på
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("cache-control", "no-store");

  const supabase = await supabaseRoute(res);

  if (!access_token || !refresh_token) {
    return copySetCookie(
      res,
      NextResponse.json(
        { ok: false, code: "BAD_INPUT", message: "Mangler access_token/refresh_token" },
        { status: 400 }
      )
    );
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return copySetCookie(
      res,
      NextResponse.json(
        { ok: false, code: "SESSION_SET_FAILED", message: error.message },
        { status: 401 }
      )
    );
  }

  return res;
}
