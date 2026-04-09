import "server-only";

import { sendEmail } from "@/lib/sales/email";
import { createLinkedInDraft } from "@/lib/sales/linkedin";
import type { SalesOutreachQueueItem } from "@/lib/sales/outreachQueueTypes";
import { canSend, markSent } from "@/lib/sales/rateLimit";
import { logSalesSend } from "@/lib/sales/sendLog";

export type AutoSendResult = {
  results: SalesOutreachQueueItem[];
  blockedReason?: "disabled" | "no_explicit_run_approval";
};

function isKillSwitchOn(): boolean {
  return process.env.SALES_AUTOSEND_ENABLED === "true";
}

/**
 * Kontrollert utsendelse: kill switch, eksplisitt API-godkjenning, rate limit (kun e-post).
 * LinkedIn: aldri auto-send — status `ready_manual` + utkast.
 */
export async function runAutoSend(
  queue: SalesOutreachQueueItem[],
  opts: {
    explicitRunApproved: boolean;
    actorEmail?: string | null;
    idempotencyKey?: string | null;
  },
): Promise<AutoSendResult> {
  if (!opts.explicitRunApproved) {
    console.warn("[SALES_AUTOSEND_BLOCKED]", { reason: "no_explicit_run_approval" });
    return { results: [], blockedReason: "no_explicit_run_approval" };
  }

  if (!isKillSwitchOn()) {
    console.warn("[SALES_AUTOSEND_BLOCKED]", { reason: "disabled", env: "SALES_AUTOSEND_ENABLED" });
    await logSalesSend({
      route: "runAutoSend",
      dealId: "system",
      channel: "system",
      status: "blocked_kill_switch",
      actorEmail: opts.actorEmail ?? null,
      idempotencyKey: opts.idempotencyKey ?? null,
      detail: { reason: "SALES_AUTOSEND_ENABLED_not_true" },
    });
    return { results: [], blockedReason: "disabled" };
  }

  const list = Array.isArray(queue) ? queue : [];
  const out: SalesOutreachQueueItem[] = [];

  for (let i = 0; i < list.length; i++) {
    const item = { ...list[i] };

    if (item.status !== "approved") {
      out.push(item);
      continue;
    }

    if (item.channel === "linkedin") {
      const draft = createLinkedInDraft({ name: item.company, message: item.message });
      const next: SalesOutreachQueueItem = {
        ...item,
        status: "ready_manual",
        linkedinDraft: draft,
        sentAt: null,
        approvedAt: item.approvedAt ?? Date.now(),
      };
      await logSalesSend({
        route: "runAutoSend",
        dealId: item.dealId,
        channel: "linkedin",
        status: "ready_manual",
        actorEmail: opts.actorEmail ?? null,
        idempotencyKey: opts.idempotencyKey ?? null,
      });
      console.log("[SALES_LINKEDIN_DRAFT]", { dealId: item.dealId, company: item.company });
      out.push(next);
      continue;
    }

    if (item.channel === "email") {
      const to = typeof item.email === "string" ? item.email.trim() : "";
      if (!to || !to.includes("@")) {
        const failed: SalesOutreachQueueItem = {
          ...item,
          status: "failed",
          sentAt: null,
        };
        await logSalesSend({
          route: "runAutoSend",
          dealId: item.dealId,
          channel: "email",
          status: "failed",
          actorEmail: opts.actorEmail ?? null,
          idempotencyKey: opts.idempotencyKey ?? null,
          detail: { reason: "missing_or_invalid_email" },
        });
        console.warn("[SALES_SEND_FAIL]", { dealId: item.dealId, reason: "invalid_email" });
        out.push(failed);
        continue;
      }

      if (!canSend()) {
        console.warn("[RATE_LIMIT]", { dealId: item.dealId });
        await logSalesSend({
          route: "runAutoSend",
          dealId: item.dealId,
          channel: "email",
          status: "rate_limited",
          actorEmail: opts.actorEmail ?? null,
          idempotencyKey: opts.idempotencyKey ?? null,
        });
        out.push({ ...item, status: "failed", sentAt: null });
        for (let j = i + 1; j < list.length; j++) {
          out.push({ ...list[j] });
        }
        break;
      }

      try {
        const res = await sendEmail({
          to,
          subject: "Oppfølging — Lunchportalen",
          body: item.message,
          explicitApproved: true,
        });

        if (res.ok) {
          markSent();
          const sent: SalesOutreachQueueItem = {
            ...item,
            status: "sent",
            sentAt: Date.now(),
            email: to,
          };
          await logSalesSend({
            route: "runAutoSend",
            dealId: item.dealId,
            channel: "email",
            status: "sent",
            actorEmail: opts.actorEmail ?? null,
            idempotencyKey: opts.idempotencyKey ?? null,
          });
          out.push(sent);
        } else {
          const errMsg = "error" in res ? res.error : "unknown";
          const failed: SalesOutreachQueueItem = {
            ...item,
            status: "failed",
            sentAt: null,
          };
          await logSalesSend({
            route: "runAutoSend",
            dealId: item.dealId,
            channel: "email",
            status: "failed",
            actorEmail: opts.actorEmail ?? null,
            idempotencyKey: opts.idempotencyKey ?? null,
            detail: { error: errMsg },
          });
          console.error("[SEND_FAIL]", { dealId: item.dealId, error: errMsg });
          out.push(failed);
        }
      } catch (err) {
        console.error("[SEND_FAIL]", err);
        await logSalesSend({
          route: "runAutoSend",
          dealId: item.dealId,
          channel: "email",
          status: "failed",
          actorEmail: opts.actorEmail ?? null,
          idempotencyKey: opts.idempotencyKey ?? null,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
        out.push({ ...item, status: "failed", sentAt: null });
      }
      continue;
    }

    out.push(item);
  }

  console.log("[SALES_AUTOSEND]", { processed: out.length, idempotencyKey: opts.idempotencyKey ?? null });

  return { results: out };
}
