import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rid = makeRid();
  try {
    const host = req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const cookieNames = req.cookies.getAll().map((c) => c.name);

    return jsonOk(rid, {
      ok: true,
      host,
      proto,
      cookieNames,
      hasSupabaseCookie: cookieNames.some((n) => n.startsWith("sb-") || n.startsWith("__Secure-sb-")),
    }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente cookie-info.", 500, { code: "COOKIE_DEBUG_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
