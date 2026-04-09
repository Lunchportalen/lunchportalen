import "server-only";

import type { SecurityAnomaly, SecurityAnomalyType } from "@/lib/security/anomaly";

const ANOMALY_TYPES: ReadonlySet<string> = new Set<SecurityAnomalyType>([
  "TENANT_ATTACK",
  "ACCESS_ANOMALY",
  "LOGIN_ATTACK",
  "AI_ABUSE",
]);

const RATE_MS = 60_000;
const lastSentByType = new Map<string, number>();

export function formatSlackMessage(alert: SecurityAnomaly): string {
  return `
🚨 SECURITY ALERT

Type: ${alert.type}
Severity: ${alert.severity}
Count: ${alert.count}

Context:
- Time: ${new Date().toISOString()}
- System: Lunchportalen

Details:
${alert.explanation}
`.trim();
}

function formatEmailBody(alert: SecurityAnomaly): string {
  return formatSlackMessage(alert);
}

/**
 * Same alert `type` max once per {@link RATE_MS} (process-local; best-effort on serverless).
 */
export function isSecurityAlertRateLimited(type: string): boolean {
  const key = String(type ?? "").trim();
  if (!key) return true;
  const last = lastSentByType.get(key);
  if (last === undefined) return false;
  return Date.now() - last < RATE_MS;
}

function markSecurityAlertSent(type: string): void {
  const key = String(type ?? "").trim();
  if (!key) return;
  lastSentByType.set(key, Date.now());
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export function parseSecurityAlertBody(raw: unknown): SecurityAnomaly | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = safeTrim(o.type);
  if (!type || !ANOMALY_TYPES.has(type)) return null;
  if (o.severity !== "CRITICAL") return null;
  const count = Number(o.count);
  if (!Number.isFinite(count) || count < 0) return null;
  const previousWindowCount = Number(o.previousWindowCount);
  const prevOk = Number.isFinite(previousWindowCount) && previousWindowCount >= 0;
  const explanation = safeTrim(o.explanation);
  if (!explanation) return null;
  const trend = o.trend === "up" ? "up" : null;
  return {
    type: type as SecurityAnomalyType,
    severity: "CRITICAL",
    count: Math.floor(count),
    previousWindowCount: prevOk ? Math.floor(previousWindowCount) : 0,
    trend,
    explanation,
  };
}

async function sendSlackIfConfigured(alert: SecurityAnomaly): Promise<void> {
  const url = safeTrim(process.env.SECURITY_SLACK_WEBHOOK);
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: formatSlackMessage(alert) }),
  });
}

async function sendEmailIfConfigured(alert: SecurityAnomaly): Promise<void> {
  const to = safeTrim(process.env.SECURITY_ALERT_EMAIL_TO);
  if (!to) return;

  const host = safeTrim(process.env.ORDER_SMTP_HOST) || "mail.lunchportalen.no";
  const portRaw = safeTrim(process.env.ORDER_SMTP_PORT) || "587";
  const port = Number(portRaw);
  const user = safeTrim(process.env.ORDER_SMTP_USER);
  const pass = safeTrim(process.env.ORDER_SMTP_PASS);
  const from = safeTrim(process.env.ORDER_BACKUP_FROM) || user;
  if (!user || !pass || !from) return;

  const secure =
    safeTrim(process.env.ORDER_SMTP_SECURE).toLowerCase() === "true" || port === 465;

  const mod = await import("nodemailer");
  const nodemailer = mod.default ?? mod;
  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: { user, pass },
  });

  const subject = `[Lunchportalen] SECURITY ${alert.type} (${alert.severity}) count=${alert.count}`;
  await transporter.sendMail({
    from,
    to,
    subject,
    text: formatEmailBody(alert),
  });
}

/**
 * Non-blocking outbound alerts. Swallows errors; never throws to callers.
 */
export async function sendSecurityAlert(alert: SecurityAnomaly): Promise<void> {
  try {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[ALERT]", alert);
    }

    const typeKey = String(alert.type ?? "").trim();
    if (!typeKey) return;
    if (isSecurityAlertRateLimited(typeKey)) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[ALERT:throttled]", typeKey);
      }
      return;
    }
    markSecurityAlertSent(typeKey);

    await Promise.all([sendSlackIfConfigured(alert), sendEmailIfConfigured(alert)]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[alert:error]", err);
  }
}
