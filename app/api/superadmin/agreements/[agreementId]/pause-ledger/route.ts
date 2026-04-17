export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Canonical ledger-pause (public.agreements ACTIVE → PAUSED).
 * Gate: scopeOr401 → requireRoleOr403(..., ["superadmin"]) — ingen andre roller.
 * Mutasjon: runLedgerAgreementPause → RPC lp_agreement_pause_ledger_active.
 * Ledger-gjenopptak: ingen definert resume-RPC i canonical migrasjoner — ikke eksponeres her.
 */
import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { runLedgerAgreementPause } from "@/lib/server/agreements/ledgerAgreementApproval";

type Ctx = {
  params: { agreementId: string } | Promise<{ agreementId: string }>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Pauser rader i public.agreements (ledger).
 * Skiller fra /pause som opererer på company_agreements.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.pause_ledger", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  try {
    const params = await Promise.resolve(ctx.params as any);
    const agreementId = safeStr(params?.agreementId);

    const scopeForAudit = {
      user_id: g.ctx.scope.userId,
      email: g.ctx.scope.email,
      role: g.ctx.scope.role,
    };

    const out = await runLedgerAgreementPause({
      rid,
      agreementId,
      actorUserId: safeStr(g.ctx.scope.userId) || null,
      scope: scopeForAudit,
    });

    if (out.ok === false) {
      return jsonErr(rid, out.message, out.status, out.code, out.detail);
    }

    return jsonOk(rid, out.data, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke pause avtalen.", 500, "AGREEMENT_PAUSE_LEDGER_UNEXPECTED");
  }
}
