import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";
import { sendEmail } from "@/lib/sales/email";

import type { MonitoringAlert } from "./types";

const ALERT_KIND = "monitoring_alert";
const RATE_WINDOW_MS = 10 * 60 * 1000;

function slackWebhookUrl(): string {
  const a = String(process.env.SLACK_WEBHOOK_URL ?? "").trim();
  if (a) return a;
  return String(process.env.SLACK_WEBHOOK ?? "").trim();
}

async function recentAlertCount(
  admin: SupabaseClient,
  alertType: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await admin
    .from("ai_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "audit")
    .contains("metadata", { kind: ALERT_KIND, alertType })
    .gte("created_at", sinceIso);

  if (error) {
    opsLog("monitoring_rate_limit_query_failed", { message: error.message, alertType });
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

/**
 * Non-blocking notification path: logs always; Slack/email only when not rate-limited.
 * Severity: low → log only; medium → Slack (+ history row); high → Slack + email (+ history row).
 */
export async function sendAlert(
  admin: SupabaseClient,
  alert: MonitoringAlert,
  ctx: { rid: string }
): Promise<{ sent: boolean; rateLimited: boolean }> {
  const payload = {
    rid: ctx.rid,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    explain: alert.explain,
  };

  console.log("[ALERT]", JSON.stringify(payload));

  opsLog("monitoring_alert_evaluated", payload);

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const recent = await recentAlertCount(admin, alert.type, since);
  const rateLimited = recent > 0;

  if (rateLimited) {
    opsLog("monitoring_alert_rate_limited", { ...payload, windowMin: 10 });
    return { sent: false, rateLimited: true };
  }

  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: ALERT_KIND,
      alertType: alert.type,
      severity: alert.severity,
      message: alert.message,
      explain: alert.explain,
      rid: ctx.rid,
      escalation: alert.severity === "high" ? "email_eligible" : "slack_only",
      uiVisible: alert.severity !== "low",
    },
  });

  const { error: insErr } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (insErr) {
    opsLog("monitoring_alert_history_insert_failed", { rid: ctx.rid, message: insErr.message });
  }

  if (alert.severity === "low") {
    return { sent: true, rateLimited: false };
  }

  const url = slackWebhookUrl();
  if ((alert.severity === "medium" || alert.severity === "high") && url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[${alert.severity.toUpperCase()}] ${alert.message}\n${alert.explain}\nrid=${ctx.rid}`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        opsLog("monitoring_slack_failed", { status: res.status, rid: ctx.rid });
      } else {
        opsLog("monitoring_slack_sent", { rid: ctx.rid, type: alert.type });
      }
    } catch (e) {
      opsLog("monitoring_slack_failed", { rid: ctx.rid, error: e instanceof Error ? e.message : String(e) });
    }
  } else if ((alert.severity === "medium" || alert.severity === "high") && !url) {
    opsLog("monitoring_slack_skipped", { rid: ctx.rid, reason: "no_slack_webhook" });
  }

  if (alert.severity === "high") {
    const to = String(process.env.ALERT_EMAIL ?? "").trim();
    if (to.includes("@")) {
      const r = await sendEmail({
        to,
        subject: `[Lunchportalen] Systemvarsel: ${alert.message}`,
        body: `${alert.message}\n\n${alert.explain}\n\nrid=${ctx.rid}`,
        explicitApproved: true,
      });
      opsLog(r.ok ? "monitoring_email_sent" : "monitoring_email_failed", {
        rid: ctx.rid,
        ok: r.ok,
        ...(r.ok === false ? { error: r.error } : {}),
      });
    } else {
      opsLog("monitoring_email_skipped", { rid: ctx.rid, reason: "missing_ALERT_EMAIL" });
    }
  }

  return { sent: true, rateLimited: false };
}
