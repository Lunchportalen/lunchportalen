// lib/orders/orderBackup.ts
import "server-only";
import { createHash } from "crypto";
import { osloNowISO } from "@/lib/date/oslo";
import { SYSTEM_EMAILS } from "@/lib/system/emails";

type BackupAction = "PLACE" | "CANCEL" | "TOGGLE" | "STATUS";
type BackupOutcome = "email_sent" | "email_failed";

export type OrderBackupInput = {
  rid: string;

  action: BackupAction;
  status: string;

  // Order identifiers
  orderId?: string | null;
  date: string; // YYYY-MM-DD
  slot?: string | null;

  // Actor/context
  user_id: string;
  company_id: string;
  location_id: string;

  company_name?: string | null;
  location_name?: string | null;

  actor_email?: string | null;
  actor_role?: string | null;

  // Optional extra (safe JSON)
  note?: string | null;
  extra?: any;

  // Required for audit
  timestamp_oslo?: string | null;
  checksum?: string | null;
};

export type OrderBackupResult =
  | { ok: true; outcome: "email_sent"; attempts: number; messageId?: string; to: string; at: string }
  | { ok: false; outcome: "email_failed"; attempts: number; error: string; to: string; at: string };

function env(name: string, fallback?: string) {
  const v = process.env[name];
  const s = String(v ?? "").trim();
  if (s) return s;
  if (typeof fallback === "string") return fallback;
  throw new Error(`Missing env: ${name}`);
}

function envInt(name: string, fallback: number) {
  const v = String(process.env[name] ?? "").trim();
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function checksumFor(input: {
  rid: string;
  action: BackupAction;
  status: string;
  orderId?: string | null;
  date: string;
  slot?: string | null;
  user_id: string;
  company_id: string;
  company_name?: string | null;
  location_id: string;
  location_name?: string | null;
  timestamp_oslo: string;
}) {
  const payload = [
    input.rid,
    input.action,
    input.status,
    input.orderId ?? "",
    input.date,
    input.slot ?? "",
    input.user_id,
    input.company_id,
    input.company_name ?? "",
    input.location_id,
    input.location_name ?? "",
    input.timestamp_oslo,
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * SMTP settings (defaults to your locked infra)
 * Required env:
 * - ORDER_SMTP_PASS
 *
 * Optional env:
 * - ORDER_SMTP_HOST (default mail.lunchportalen.no)
 * - ORDER_SMTP_PORT (default 587)
 * - ORDER_SMTP_SECURE (default false)
 * - ORDER_SMTP_USER (default ORDER_EMAIL)
 * - ORDER_BACKUP_FROM (default ORDER_EMAIL)
 * - ORDER_BACKUP_TO (default ORDER_EMAIL)
 */
function smtpConfig() {
  const host = env("ORDER_SMTP_HOST", "mail.lunchportalen.no");
  const port = envInt("ORDER_SMTP_PORT", 587);
  const secure = String(process.env.ORDER_SMTP_SECURE ?? "").trim().toLowerCase() === "true" || port === 465;

  const user = env("ORDER_SMTP_USER", SYSTEM_EMAILS.ORDER);
  const pass = env("ORDER_SMTP_PASS"); // must exist

  const from = env("ORDER_BACKUP_FROM", user);
  const to = env("ORDER_BACKUP_TO", SYSTEM_EMAILS.ORDER);

  return { host, port, secure, user, pass, from, to };
}

async function sendMailNodemailer(input: OrderBackupInput) {
  // dynamic import => server only + avoid bundling issues
  const mod = await import("nodemailer");
  const nodemailer = mod.default ?? mod;

  const cfg = smtpConfig();

  const timestampOslo = String(input.timestamp_oslo ?? "").trim() || osloNowISO();
  const checksum =
    String(input.checksum ?? "").trim() ||
    checksumFor({
      rid: input.rid,
      action: input.action,
      status: input.status,
      orderId: input.orderId ?? null,
      date: input.date,
      slot: input.slot ?? null,
      user_id: input.user_id,
      company_id: input.company_id,
      company_name: input.company_name ?? null,
      location_id: input.location_id,
      location_name: input.location_name ?? null,
      timestamp_oslo: timestampOslo,
    });

  const subject = `[Lunchportalen] ${input.action} ${input.status} - ${input.date} - rid=${input.rid}`;
  const at = new Date().toISOString();

  const text = [
    `RID: ${input.rid}`,
    `AT: ${at}`,
    `TIMESTAMP_OSLO: ${timestampOslo}`,
    `CHECKSUM: ${checksum}`,
    ``,
    `ACTION: ${input.action}`,
    `STATUS: ${input.status}`,
    ``,
    `ORDER:`,
    `- orderId: ${input.orderId ?? "-"}`,
    `- date: ${input.date}`,
    `- slot: ${input.slot ?? "-"}`,
    `- note: ${input.note ?? "-"}`,
    ``,
    `SCOPE:`,
    `- user_id: ${input.user_id}`,
    `- company_id: ${input.company_id}`,
    `- company_name: ${input.company_name ?? "-"}`,
    `- location_id: ${input.location_id}`,
    `- location_name: ${input.location_name ?? "-"}`,
    ``,
    `ACTOR:`,
    `- email: ${input.actor_email ?? "-"}`,
    `- role: ${input.actor_role ?? "-"}`,
    ``,
    `EXTRA:`,
    safeJson(input.extra ?? null),
    ``,
  ].join("\n");

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({
    from: cfg.from,
    to: cfg.to,
    subject,
    text,
  });

  return { messageId: String((info as any)?.messageId ?? "") || undefined, to: cfg.to, at };
}

/**
 * Send order backup email with retry.
 * - Attempts: 3
 * - Backoff: 250ms, 800ms, 1600ms (deterministic)
 */
export async function sendOrderBackup(input: OrderBackupInput): Promise<OrderBackupResult> {
  const at = new Date().toISOString();
  const cfg = smtpConfig(); // validates env early

  const maxAttempts = 3;
  const backoff = [250, 800, 1600];

  let lastErr = "Unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const sent = await sendMailNodemailer(input);
      return {
        ok: true,
        outcome: "email_sent",
        attempts: attempt,
        messageId: sent.messageId,
        to: sent.to,
        at: sent.at,
      };
    } catch (e: any) {
      lastErr = String(e?.message ?? e ?? "Unknown error");
      if (attempt < maxAttempts) await sleep(backoff[attempt - 1] ?? 800);
    }
  }

  return {
    ok: false,
    outcome: "email_failed",
    attempts: maxAttempts,
    error: lastErr,
    to: cfg.to,
    at,
  };
}
