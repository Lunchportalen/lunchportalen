// lib/orderBackup/env.ts
function req(name: string, v: string | undefined) {
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v);
}

export function getOrderBackupEnv() {
  return {
    SMTP_HOST: req("LUNCHPORTALEN_SMTP_HOST", process.env.LUNCHPORTALEN_SMTP_HOST ?? "mail.lunchportalen.no"),
    SMTP_PORT: Number(process.env.LUNCHPORTALEN_SMTP_PORT ?? "587"),
    SMTP_SECURE: String(process.env.LUNCHPORTALEN_SMTP_SECURE ?? "").toLowerCase() === "true", // true = 465
    SMTP_USER: req("LUNCHPORTALEN_SMTP_USER", process.env.LUNCHPORTALEN_SMTP_USER ?? "ordre@lunchportalen.no"),
    SMTP_PASS: req("LUNCHPORTALEN_SMTP_PASS", process.env.LUNCHPORTALEN_SMTP_PASS),
    MAIL_FROM: String(process.env.LUNCHPORTALEN_MAIL_FROM ?? "ordre@lunchportalen.no"),
    MAIL_TO: String(process.env.LUNCHPORTALEN_MAIL_TO ?? "ordre@lunchportalen.no"),
  };
}
