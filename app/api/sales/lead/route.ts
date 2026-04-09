export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { classifyLead } from "@/lib/sales/pipeline";
import { generateFollowUp } from "@/lib/sales/followup";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(req: NextRequest): Promise<Response> {
  const rid = makeRid("sales_lead");
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "INVALID_JSON");
    }

    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const email = typeof o.email === "string" ? o.email.trim().slice(0, 320) : "";
    if (!email || !email.includes("@")) {
      return jsonErr(rid, "Ugyldig e-post.", 422, "INVALID_EMAIL");
    }

    const companySizeRaw = o.company_size;
    const companySize =
      typeof companySizeRaw === "number" && Number.isFinite(companySizeRaw)
        ? companySizeRaw
        : typeof companySizeRaw === "string" && companySizeRaw.trim()
          ? Number(companySizeRaw)
          : null;

    const segment = classifyLead({ company_size: companySize });
    const follow = generateFollowUp({
      segment,
      company: typeof o.company === "string" ? o.company : null,
    });

    await auditLog({
      action: "lead_created",
      entity: "sales",
      metadata: {
        email_domain: email.includes("@") ? (email.split("@")[1] ?? "").slice(0, 120) : "",
        segment,
        followup_subject: follow.subject,
        has_company: typeof o.company === "string" && o.company.trim().length > 0,
      },
    });

    if (process.env.HUBSPOT_SYNC_ENABLED === "true") {
      const { isHubspotConfigured } = await import("@/lib/integrations/hubspot/env");
      if (isHubspotConfigured()) {
        try {
          const { upsertContact } = await import("@/lib/integrations/hubspot/contact");
          const { createDeal } = await import("@/lib/integrations/hubspot/deal");
          const companyStr = typeof o.company === "string" ? o.company.trim().slice(0, 200) : "";
          await upsertContact(email, companyStr ? { company: companyStr } : {});
          const dealRes = await createDeal({ name: `Lead: ${email}`, amount: 0 });
          if (dealRes === null) {
            await auditLog({
              action: "hubspot_deal_skipped",
              entity: "sales",
              metadata: { reason: "missing_pipeline_stage_env" },
            });
          }
        } catch {
          await auditLog({
            action: "hubspot_sync_failed",
            entity: "sales",
            metadata: {
              email_domain: email.includes("@") ? (email.split("@")[1] ?? "").slice(0, 120) : "",
            },
          });
        }
      }
    }

    return jsonOk(rid, { ok: true, segment }, 200);
  } catch (e) {
    return jsonErr(rid, "Kunne ikke registrere henvendelse.", 500, "LEAD_FAILED", e);
  }
}
