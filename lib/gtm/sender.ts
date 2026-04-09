import "server-only";

import { makeRid } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

import type { GtmMessage } from "@/lib/gtm/outboundTemplates";

export type GtmLeadSendInput = {
  id?: string;
  email?: string;
};

export type GtmSendResult = {
  status: "logged_only" | "blocked_no_email";
  leadId: string;
  attributionRid: string;
  channel: "email" | "linkedin_placeholder";
  timestamp: number;
};

/**
 * Erstattbar adapter: logger alltid (SOC2), sender ikke eksternt uten egen ESP/LinkedIn-integrasjon.
 * Alle utgående spor skal ha `attributionRid` for kobling til ordre/CRM.
 */
export async function sendMessage(message: GtmMessage, lead: GtmLeadSendInput): Promise<GtmSendResult> {
  const attributionRid = makeRid("gtm_outbound");
  const leadId = String(lead.id ?? "unknown").trim() || "unknown";
  const to = typeof lead.email === "string" ? lead.email.trim() : "";

  if (!to) {
    opsLog("gtm_send_blocked", { attributionRid, leadId, reason: "missing_email", subject: message.subject });
    return {
      status: "blocked_no_email",
      leadId,
      attributionRid,
      channel: "email",
      timestamp: Date.now(),
    };
  }

  opsLog("gtm_send_intent", {
    attributionRid,
    leadId,
    to_domain: to.includes("@") ? to.split("@")[1] : "",
    subject: message.subject,
    body_preview: message.body.slice(0, 280),
    channel: "email",
  });

  return {
    status: "logged_only",
    leadId,
    attributionRid,
    channel: "email",
    timestamp: Date.now(),
  };
}
