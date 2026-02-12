// app/api/something/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { makeRid } from "@/lib/http/respond";
import { handleSomething } from "@/lib/http/something";

type Body = {
  userId?: string;
  payload?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function ok(rid: string, data?: any, status = 200) {
  return NextResponse.json({ ok: true, rid, data }, { status });
}

function err(rid: string, error: string, message: string, status = 400, data?: any) {
  return NextResponse.json({ ok: false, rid, error, message, status, data }, { status });
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err(rid, "BAD_JSON", "Ugyldig JSON i request body.", 400);
  }

  const userId = safeStr(body?.userId);
  const payload = body?.payload;

  if (!userId) {
    return err(rid, "BAD_REQUEST", "Mangler userId.", 400);
  }

  try {
    const result = await handleSomething({ userId, payload });

    // Hvis handleSomething allerede returnerer ok:false, map det inn i kontrakten
    if (!result || (result as any).ok !== true) {
      const code = safeStr((result as any)?.error) || "SOMETHING_FAILED";
      const msg = safeStr((result as any)?.message) || "Kunne ikke fullføre forespørselen.";
      return err(rid, code, msg, 400, (result as any)?.data ?? result);
    }

    // OK
    return ok(rid, (result as any).data ?? result, 200);
  } catch (e: any) {
    const msg = safeStr(e?.message) || "Ukjent feil.";
    return err(rid, "INTERNAL_ERROR", msg, 500);
  }
}
