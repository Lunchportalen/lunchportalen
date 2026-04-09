import "server-only";

import { Resend } from "resend";

import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE } from "@/lib/ai/rateLimit";
import { makeRid } from "@/lib/http/respond";
import { recordLiveEmailSent } from "@/lib/live/campaignStats";
import { opsLog } from "@/lib/ops/log";

import { trackEmailSend } from "@/lib/email/track";
import { RESEND_DEFAULT_FROM_ORDER } from "@/lib/system/emails";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  /** Menneske/prosess-godkjenning — påkrevd for faktisk utsending. */
  explicitApproval: boolean;
  campaignId?: string;
  /** Liste-URL (List-Unsubscribe / footer) — anbefalt for produksjon. */
  unsubscribeUrl?: string;
};

/**
 * Resend-utsending. Fail-closed:
 * - `LP_RESEND_LIVE_SEND=true` OG `RESEND_API_KEY` OG `explicitApproval` — ellers ingen ekstern send.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{
  status: "sent" | "skipped" | "blocked";
  id?: string;
  rid: string;
  reason?: string;
}> {
  const rid = makeRid("email_send");
  const live = String(process.env.LP_RESEND_LIVE_SEND ?? "").trim() === "true";

  if (!args.explicitApproval) {
    opsLog("email_send_blocked", { rid, reason: "no_explicit_approval" });
    return { status: "blocked", rid, reason: "no_explicit_approval" };
  }
  if (!live) {
    trackEmailSend({
      rid,
      subject: args.subject?.slice(0, 120),
      toDomain: safeDomain(args.to),
      campaignId: args.campaignId,
    });
    opsLog("email_send_skipped", { rid, reason: "LP_RESEND_LIVE_SEND_not_true" });
    return { status: "skipped", rid, reason: "live_disabled" };
  }

  const key = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!key) {
    opsLog("email_send_skipped", { rid, reason: "missing_RESEND_API_KEY" });
    return { status: "skipped", rid, reason: "missing_api_key" };
  }

  const from = String(process.env.LP_RESEND_FROM ?? RESEND_DEFAULT_FROM_ORDER).trim();
  const resend = new Resend(key);

  const headers: Record<string, string> = {};
  if (args.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${args.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const res = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      headers: Object.keys(headers).length ? headers : undefined,
    });

    if (res.error) {
      const msg = res.error.message ?? "resend_error";
      opsLog("email_send_error", { rid, error: msg });
      return { status: "skipped", rid, reason: msg };
    }

    const id = typeof res.data?.id === "string" ? res.data.id : undefined;
    trackEmailSend({
      rid,
      messageId: id,
      subject: args.subject?.slice(0, 120),
      toDomain: safeDomain(args.to),
      campaignId: args.campaignId,
    });
    recordLiveEmailSent(1);
    opsLog("email_send_ok", { rid, id, toDomain: safeDomain(args.to) });
    return { status: "sent", id, rid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("email_send_error", { rid, error: msg });
    return { status: "skipped", rid, reason: msg };
  }
}

function safeDomain(to: string): string | undefined {
  const s = String(to ?? "").trim();
  if (!s.includes("@")) return undefined;
  return s.split("@")[1]?.slice(0, 120);
}
