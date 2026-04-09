export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { makeRid } from "@/lib/http/respond";
import { allowNextForRole, landingForRole } from "@/lib/auth/role";
import {
  buildLocalDevAuthSession,
  isLocalDevAuthBypassEnabled,
  writeLocalDevAuthSessionCookies,
} from "@/lib/auth/devBypass";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNextPath(next: string | null | undefined): string | null {
  const n = safeStr(next);
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api/")) return null;
  if (/[\r\n\t]/.test(n)) return null;
  if (n === "/login" || n.startsWith("/login/")) return null;
  return n;
}

function jsonErr(rid: string, status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, rid, error, message, status }, { status });
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  if (!isLocalDevAuthBypassEnabled()) {
    return jsonErr(rid, 403, "DEV_AUTH_DISABLED", "Lokal utviklingsøkt er ikke aktivert i dette miljøet.");
  }

  const body = (await req.json().catch(() => ({}))) as { next?: unknown };
  const nextSafe = safeNextPath(body?.next as string | null | undefined);
  const target = allowNextForRole("superadmin", nextSafe) ?? landingForRole("superadmin");
  const session = buildLocalDevAuthSession();

  const res = NextResponse.json(
    {
      ok: true,
      rid,
      data: {
        next: target,
      },
    },
    { status: 200 },
  );
  writeLocalDevAuthSessionCookies(res.cookies, session);
  return res;
}
