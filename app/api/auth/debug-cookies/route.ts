import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const cookieNames = req.cookies.getAll().map((c) => c.name);

  return NextResponse.json(
    {
      ok: true,
      host,
      proto,
      cookieNames,
      hasSupabaseCookie: cookieNames.some((n) => n.startsWith("sb-") || n.startsWith("__Secure-sb-")),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
