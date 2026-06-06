import "server-only";

import nodemailer from "nodemailer";

import { SUPPORT_EMAIL, SYSTEM_EMAIL_ALLOWLIST, normEmail } from "@/lib/system/emails";
import { opsLog } from "@/lib/ops/log";

const SEND_TIMEOUT_MS = 3000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function smtpTransport() {
  const host = process.env.SMTP_HOST || "mail.lunchportalen.no";
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function pickSystemEmail(envValue: string | undefined, fallback: string): string {
  const candidate = normEmail(envValue || fallback);
  if (SYSTEM_EMAIL_ALLOWLIST.includes(candidate)) return candidate;
  return normEmail(fallback);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type LeadSalesAlertPayload = {
  rid: string;
  leadId: string;
  name: string;
  email: string;
  company: string;
  source: string;
  phone?: string;
  company_size?: string;
  message?: string;
};

/**
 * F9 — fail-safe salgsvarsel etter vellykket RPC. Feil logges, kaster aldri.
 */
export async function sendLeadSalesAlert(payload: LeadSalesAlertPayload): Promise<void> {
  try {
    const to = pickSystemEmail(process.env.CONTACT_TO, SUPPORT_EMAIL);
    const from = pickSystemEmail(process.env.CONTACT_FROM, SUPPORT_EMAIL);
    const { rid, leadId, name, email, company, source, phone, company_size, message } = payload;

    const subject = `Ny demo-forespørsel: ${company} (RID: ${rid})`;
    const text =
      `Ny demo-forespørsel\n\n` +
      `RID: ${rid}\n` +
      `Lead-ID: ${leadId}\n` +
      `Kilde: ${source}\n` +
      `Navn: ${name}\n` +
      `E-post: ${email}\n` +
      `Bedrift: ${company}\n` +
      (phone ? `Telefon: ${phone}\n` : "") +
      (company_size ? `Antall ansatte: ${company_size}\n` : "") +
      (message ? `\nMelding:\n${message}\n` : "");

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px 0">Ny demo-forespørsel</h2>
        <div style="padding:12px 14px;border:1px solid #eee;border-radius:12px;background:#fafafa">
          <div><strong>RID:</strong> ${escapeHtml(rid)}</div>
          <div><strong>Lead-ID:</strong> ${escapeHtml(leadId)}</div>
          <div><strong>Kilde:</strong> ${escapeHtml(source)}</div>
          <div><strong>Navn:</strong> ${escapeHtml(name)}</div>
          <div><strong>E-post:</strong> ${escapeHtml(email)}</div>
          <div><strong>Bedrift:</strong> ${escapeHtml(company)}</div>
          ${phone ? `<div><strong>Telefon:</strong> ${escapeHtml(phone)}</div>` : ""}
          ${company_size ? `<div><strong>Antall ansatte:</strong> ${escapeHtml(company_size)}</div>` : ""}
        </div>
        ${
          message
            ? `<h3 style="margin:18px 0 8px 0">Melding</h3>
               <div style="white-space:pre-wrap;padding:12px 14px;border:1px solid #eee;border-radius:12px">
                 ${escapeHtml(message)}
               </div>`
            : ""
        }
      </div>
    `;

    const transporter = smtpTransport();
    await Promise.race([
      transporter.sendMail({
        from,
        to,
        replyTo: email,
        subject,
        text,
        html,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("smtp_timeout")), SEND_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    opsLog("leads.capture.sales_alert_failed", {
      rid: payload.rid,
      message: String((err as Error)?.message ?? err),
    });
  }
}
