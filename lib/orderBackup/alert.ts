// lib/orderBackup/alert.ts
import "server-only";

import { sendMail } from "@/lib/orderBackup/smtp";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function requireOne(...vals: Array<string | undefined>) {
  for (const v of vals) {
    const s = safeStr(v);
    if (s) return s;
  }
  return "";
}

export async function sendOutboxAlert(input: {
  subject: string;
  text: string;
  html?: string | null;
}) {
  const from = requireOne(process.env.ORDER_ALERT_FROM, process.env.ORDER_BACKUP_FROM);
  const to = requireOne(process.env.ORDER_ALERT_TO, process.env.ORDER_BACKUP_TO);

  // Hvis ikke satt, gjør ingenting (ikke kast)
  if (!from || !to) return { ok: false as const, skipped: true as const, reason: "missing_alert_env" };

  try {
    await sendMail({ from, to, subject: input.subject, text: input.text, html: input.html ?? null });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e) };
  }
}
