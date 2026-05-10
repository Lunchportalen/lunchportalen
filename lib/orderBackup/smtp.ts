// lib/orderBackup/smtp.ts
import "server-only";
import nodemailer from "nodemailer";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function requireResolvedEnv(value: unknown, names: string) {
  const resolved = safeStr(value);
  if (!resolved) throw new Error(`Missing env: ${names}`);
  return resolved;
}

export function getSmtpTransport() {
  const host = requireResolvedEnv(
    process.env.ORDER_SMTP_HOST ?? process.env.LP_SMTP_HOST ?? process.env.SMTP_HOST,
    "ORDER_SMTP_HOST or LP_SMTP_HOST or SMTP_HOST"
  );
  const port = parseInt(
    process.env.ORDER_SMTP_PORT ?? process.env.LP_SMTP_PORT ?? process.env.SMTP_PORT ?? "587",
    10
  );
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid env: ORDER_SMTP_PORT or LP_SMTP_PORT or SMTP_PORT");
  }
  const secure =
    (process.env.ORDER_SMTP_SECURE ?? process.env.LP_SMTP_SECURE ?? process.env.SMTP_SECURE) === "true";

  const user = requireResolvedEnv(
    process.env.ORDER_SMTP_USER ?? process.env.LP_SMTP_USER ?? process.env.SMTP_USER,
    "ORDER_SMTP_USER or LP_SMTP_USER or SMTP_USER"
  );
  const pass = requireResolvedEnv(
    process.env.ORDER_SMTP_PASS ?? process.env.LP_SMTP_PASS ?? process.env.SMTP_PASS,
    "ORDER_SMTP_PASS or LP_SMTP_PASS or SMTP_PASS"
  );

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMail(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
}) {
  const tx = getSmtpTransport();
  await tx.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || undefined,
  });
}
