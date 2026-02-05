// lib/orderBackup/env.ts
import { SYSTEM_EMAILS } from "@/lib/system/emails";
function req(name: string, v: string | undefined) {
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v);
}

export function getOrderBackupEnv() {
  return {
    SMTP_HOST: req("LUNCHPORTALEN_SMTP_HOST", process.env.LUNCHPORTALEN_SMTP_HOST ?? "mail.lunchportalen.no"),
    SMTP_PORT: Number(process.env.LUNCHPORTALEN_SMTP_PORT ?? "587"),
    SMTP_SECURE: String(process.env.LUNCHPORTALEN_SMTP_SECURE ?? "").toLowerCase() === "true", // true = 465
    SMTP_USER: req("LUNCHPORTALEN_SMTP_USER", process.env.LUNCHPORTALEN_SMTP_USER ?? SYSTEM_EMAILS.ORDER),
    SMTP_PASS: req("LUNCHPORTALEN_SMTP_PASS", process.env.LUNCHPORTALEN_SMTP_PASS),
    MAIL_FROM: String(process.env.LUNCHPORTALEN_MAIL_FROM ?? SYSTEM_EMAILS.ORDER),
    MAIL_TO: String(process.env.LUNCHPORTALEN_MAIL_TO ?? SYSTEM_EMAILS.ORDER),
  };
}
