export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { isIndustry } from "@/lib/ai/industry";
import { isRole } from "@/lib/ai/role";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import type { Lead } from "@/lib/leads/types";
import { opsLog } from "@/lib/ops/log";

function isLeadPayload(v: unknown): v is Lead {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.source === "string" &&
    o.source.length > 0 &&
    typeof o.industry === "string" &&
    isIndustry(o.industry) &&
    typeof o.role === "string" &&
    isRole(o.role) &&
    typeof o.createdAt === "number"
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(request, "POST", async () => {
  const rid = makeRid();
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;

  const deny = requireRoleOr403(gate.ctx, ["company_admin", "superadmin"]);
  if (deny) return deny;

  const body = await readJson(request);
  if (body?.explicitUserApproved !== true) {
    return jsonErr(
      rid,
      "Mangler eksplisitt bruker-godkjenning — ingen CRM-synk.",
      422,
      "CRM_APPROVAL_REQUIRED",
    );
  }

  const lead = body?.lead;
  if (!isLeadPayload(lead)) {
    return jsonErr(rid, "Ugyldig lead-objekt (id, source, industry, role, createdAt).", 422, "CRM_LEAD_INVALID");
  }

  opsLog("crm", {
    level: "info",
    rid,
    msg: "crm_lead_received",
    leadId: lead.id,
    sourceLen: lead.source.length,
  });

  const forwardUrl = process.env.CRM_OUTBOUND_WEBHOOK_URL?.trim();
  let forwarded = false;
  if (forwardUrl && /^https?:\/\//i.test(forwardUrl)) {
    try {
      const fr = await fetch(forwardUrl, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ rid, lead }),
        signal: AbortSignal.timeout(8000),
      });
      forwarded = fr.ok;
    } catch {
      forwarded = false;
    }
  }

  return jsonOk(
    rid,
    {
      received: true,
      forwarded,
      leadId: lead.id,
      message: forwarded
        ? "Lead videresendt til konfigurert CRM-webhook."
        : "Lead akseptert (ingen ekstern webhook konfigurert eller videresending feilet).",
    },
    200,
  );
  });
}
