export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = {
  params: { agreementId: string } | Promise<{ agreementId: string }>;
};

type ApproveRpcOut = {
  agreement_id?: unknown;
  company_id?: unknown;
  status?: unknown;
  receipt?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  const s = safeStr(v);
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

function mapRpcError(messageRaw: unknown) {
  const m = safeStr(messageRaw).toUpperCase();

  if (m.includes("AGREEMENT_NOT_FOUND")) {
    return { status: 404, code: "AGREEMENT_NOT_FOUND", message: "Fant ikke avtale." };
  }
  if (m.includes("ACTIVE_AGREEMENT_EXISTS")) {
    return {
      status: 409,
      code: "ACTIVE_AGREEMENT_EXISTS",
      message: "Det finnes allerede en aktiv avtale for dette firmaet.",
    };
  }
  if (m.includes("AGREEMENT_NOT_PENDING")) {
    return { status: 409, code: "AGREEMENT_NOT_PENDING", message: "Avtalen er ikke i status Venter." };
  }
  if (m.includes("AGREEMENT_ID_REQUIRED")) {
    return { status: 400, code: "AGREEMENT_ID_REQUIRED", message: "Ugyldig avtale." };
  }

  return { status: 500, code: "AGREEMENT_APPROVE_FAILED", message: "Kunne ikke godkjenne avtalen." };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.approve", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  try {
    const params = await Promise.resolve(ctx.params as any);
    const agreementId = safeStr(params?.agreementId);
    if (!isUuid(agreementId)) return jsonErr(rid, "Ugyldig avtale.", 400, "BAD_INPUT");

    const admin = supabaseAdmin();
    const actorUserId = safeStr(g.ctx.scope.userId);

    const { data, error } = await admin.rpc("lp_agreement_approve_active", {
      p_agreement_id: agreementId,
      p_actor_user_id: actorUserId || null,
    });

    if (error) {
      const mapped = mapRpcError(error.message);
      return jsonErr(rid, mapped.message, mapped.status, mapped.code);
    }

    const out = (data ?? null) as ApproveRpcOut | null;
    const outAgreementId = safeStr(out?.agreement_id);
    const companyId = safeStr(out?.company_id);
    const status = safeStr(out?.status).toUpperCase();
    const receipt = safeStr(out?.receipt);

    if (!outAgreementId || !companyId || !status || !receipt) {
      return jsonErr(rid, "Kunne ikke godkjenne avtalen.", 500, "AGREEMENT_APPROVE_BAD_RESPONSE");
    }

    return jsonOk(
      rid,
      {
        agreementId: outAgreementId,
        companyId,
        status,
        receipt,
        message: "Avtalen er godkjent",
      },
      200
    );
  } catch {
    return jsonErr(rid, "Kunne ikke godkjenne avtalen.", 500, "AGREEMENT_APPROVE_UNEXPECTED");
  }
}
