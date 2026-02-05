// lib/orderBackup/smtp.ts
import "server-only";
import nodemailer from "nodemailer";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !safeStr(v)) throw new Error(`Missing env: ${name}`);
  return safeStr(v);
}

export function getSmtpTransport() {
  const host = requireEnv("ORDER_SMTP_HOST");
  const port = Number(requireEnv("ORDER_SMTP_PORT"));
  const secure = safeStr(process.env.ORDER_SMTP_SECURE ?? "").toLowerCase() === "true";

  const user = requireEnv("ORDER_SMTP_USER");
  const pass = requireEnv("ORDER_SMTP_PASS");

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
