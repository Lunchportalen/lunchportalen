import type { NextRequest } from "next/server";

export function norwayClientMeta(req: NextRequest | Request) {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  const ip = (forwarded?.split(",")[0] || headers.get("x-real-ip") || "").trim() || null;
  const userAgent = headers.get("user-agent");
  return { ip, userAgent };
}
