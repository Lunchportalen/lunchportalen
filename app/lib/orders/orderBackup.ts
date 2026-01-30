// lib/orders/orderBackup.ts
import "server-only";

type BackupAction = "PLACE" | "CANCEL" | "TOGGLE";
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

  actor_email?: string | null;
  actor_role?: string | null;

  // Optional extra (safe JSON)
  note?: string | null;
  extra?: any;
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
 * - ORDER_SMTP_USER (default ordre@lunchportalen.no)
 * - ORDER_BACKUP_FROM (default ordre@lunchportalen.no)
 * - ORDER_BACKUP_TO (default ordre@lunchportalen.no)
 */
function smtpConfig() {
  const host = env("ORDER_SMTP_HOST", "mail.lunchportalen.no");
  const port = envInt("ORDER_SMTP_PORT", 587);
  const secure = String(process.env.ORDER_SMTP_SECURE ?? "").trim().toLowerCase() === "true" || port === 465;

  const user = env("ORDER_SMTP_USER", "ordre@lunchportalen.no");
  const pass = env("ORDER_SMTP_PASS"); // must exist

  const from = env("ORDER_BACKUP_FROM", user);
  const to = env("ORDER_BACKUP_TO", "ordre@lunchportalen.no");

  return { host, port, secure, user, pass, from, to };
}

async function sendMailNodemailer(input: OrderBackupInput) {
  // dynamic import => server only + unngår bundling issues
  const mod = await import("nodemailer");
  const nodemailer = mod.default ?? mod;

  const cfg = smtpConfig();

  const subject = `[Lunchportalen] ${input.action} ${input.status} – ${input.date} – rid=${input.rid}`;
  const at = new Date().toISOString();

  const text = [
    `RID: ${input.rid}`,
    `AT: ${at}`,
    ``,
    `ACTION: ${input.action}`,
    `STATUS: ${input.status}`,
    ``,
    `ORDER:`,
    `- orderId: ${input.orderId ?? "—"}`,
    `- date: ${input.date}`,
    `- slot: ${input.slot ?? "—"}`,
    `- note: ${input.note ?? "—"}`,
    ``,
    `SCOPE:`,
    `- user_id: ${input.user_id}`,
    `- company_id: ${input.company_id}`,
    `- location_id: ${input.location_id}`,
    ``,
    `ACTOR:`,
    `- email: ${input.actor_email ?? "—"}`,
    `- role: ${input.actor_role ?? "—"}`,
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
 * - Backoff: 250ms, 800ms, 1600ms (deterministisk)
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
