export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.json({ ok: true, set: true }, { status: 200 });
  res.cookies.set({
    name: "lp_cookie_test",
    value: "1",
    path: "/",
    sameSite: "lax",
    secure: false, // localhost
  });
  return res;
}
