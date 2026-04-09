export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

type RouteCtx = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuidish(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function errCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return safeStr((error as Record<string, unknown>).code);
}

function errMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return safeStr((error as Record<string, unknown>).message).toLowerCase();
}

function isOutboxConflictError(error: unknown): boolean {
  const code = errCode(error);
  const message = errMessage(error);
  return code === "23505" || message.includes("duplicate") || message.includes("conflict");
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const rid = makeRid();

  try {
    const sb = await supabaseServer();
    const { data: auth, error: authErr } = await sb.auth.getUser();

    if (authErr || !auth?.user) {
      return jsonErr(rid, "Ingen tilgang.", 401, "UNAUTHORIZED");
    }

    if (!(await isSuperadminProfile(auth.user.id))) {
      return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
    }

    const params = await Promise.resolve(ctx.params);
    const companyId = safeStr(params?.companyId);
    if (!isUuidish(companyId)) {
      return jsonErr(rid, "Ugyldig forespørsel.", 400, "BAD_COMPANY_ID");
    }

    const { error: activateErr } = await sb.rpc("lp_company_activate", { p_company_id: companyId });
    if (activateErr) {
      return jsonErr(rid, "Kunne ikke aktivere bedriften.", 500, {
        code: "COMPANY_ACTIVATE_FAILED",
        detail: { message: safeStr(activateErr.message) },
      });
    }

    const outboxRow = {
      event_key: `company.activated:${companyId}`,
      status: "PENDING" as const,
      attempts: 0,
      payload: {
        companyId,
        rid,
        event: "company.activated",
      },
    };

    const { error: outboxErr } = await sb.from("outbox").upsert(outboxRow, { onConflict: "event_key" });
    if (outboxErr && !isOutboxConflictError(outboxErr)) {
      return jsonErr(rid, "Kunne ikke aktivere bedriften.", 500, {
        code: "OUTBOX_UPSERT_FAILED",
        detail: { message: safeStr((outboxErr as { message?: unknown }).message) },
      });
    }

    return jsonOk(
      rid,
      {
        companyId,
        message: "Bedriften er aktiv.",
      },
      200
    );
  } catch (error: unknown) {
    return jsonErr(rid, "Kunne ikke aktivere bedriften.", 500, {
      code: "COMPANY_ACTIVATE_UNEXPECTED",
      detail: { message: safeStr(error instanceof Error ? error.message : error) },
    });
  }
}
