// lib/ops/notifyOps.ts
import "server-only";
import { SYSTEM_EMAILS } from "@/lib/system/emails";

type NotifyOpsInput = {
  subject: string;
  text: string;
  rid?: string;
  exportId?: string;
};

function env(k: string) {
  return String(process.env[k] ?? "").trim();
}

/**
 * Bruker SMTP hvis tilgjengelig.
 * Hvis ikke: fail-closed i logikk (API skal fortsatt returnere blokkert),
 * men e-post kan feile "soft" (det er varsel, ikke dataintegritet).
 */
export async function notifyOps(input: NotifyOpsInput) {
  const host = env("LP_SMTP_HOST") || env("SMTP_HOST") || "mail.lunchportalen.no";
  const portStr = env("LP_SMTP_PORT") || env("SMTP_PORT") || "587";
  const user = env("LP_SMTP_USER") || env("SMTP_USER");
  const pass = env("LP_SMTP_PASS") || env("SMTP_PASS");
  const from = env("LP_OPS_FROM") || env("OPS_FROM") || SYSTEM_EMAILS.ORDER;
  const to = env("LP_OPS_TO") || env("OPS_TO") || SYSTEM_EMAILS.ORDER;

  // Hvis creds mangler: logg, men ikke kast (varsling er sekundÃ¦rt)
  if (!user || !pass) {
    console.warn("[ops.notify] Missing SMTP creds, cannot email ops.", {
      rid: input.rid,
      exportId: input.exportId,
      subject: input.subject,
    });
    return { ok: false, skipped: true };
  }

  let nodemailer: any;
  try {
    nodemailer = await import("nodemailer");
  } catch {
    console.warn("[ops.notify] nodemailer not installed.");
    return { ok: false, skipped: true };
  }

  const port = Number(portStr) || 587;
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const body =
    `${input.text}\n\n` +
    `RID: ${input.rid ?? "-"}\n` +
    `exportId: ${input.exportId ?? "-"}\n` +
    `timestamp: ${new Date().toISOString()}\n`;

  await transporter.sendMail({
    from,
    to,
    subject: input.subject,
    text: body,
  });

  return { ok: true };
}


