import "server-only";

import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  /** Må være true — dobbeltsjekk fra API/kallkjede. */
  explicitApproved: boolean;
};

export type SendEmailResult = { ok: true } | { ok: false; error: string };

function mustEnv(name: string): string | null {
  const v = String(process.env[name] ?? "").trim();
  return v || null;
}

/**
 * SMTP direkte (server). Uten SMTP_HOST: fail-closed, ingen nettverkskall.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (input.explicitApproved !== true) {
    console.warn("[EMAIL_BLOCKED]", { reason: "no_explicit_approval" });
    return { ok: false, error: "NO_EXPLICIT_APPROVAL" };
  }

  const host = mustEnv("SMTP_HOST");
  if (!host) {
    console.warn("[EMAIL_DISABLED]", { reason: "missing_smtp_host" });
    return { ok: false, error: "SMTP_DISABLED" };
  }

  const portRaw = mustEnv("SMTP_PORT");
  const user = mustEnv("SMTP_USER");
  const pass = mustEnv("SMTP_PASS");
  const from = String(process.env.SMTP_FROM ?? user ?? "").trim();
  const to = String(input.to ?? "").trim();

  if (!portRaw || !user || !pass || !from) {
    console.warn("[EMAIL_DISABLED]", { reason: "incomplete_smtp_env" });
    return { ok: false, error: "SMTP_INCOMPLETE" };
  }
  if (!to || !to.includes("@")) {
    return { ok: false, error: "INVALID_TO" };
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    return { ok: false, error: "INVALID_SMTP_PORT" };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transport.sendMail({
      from,
      to,
      subject: String(input.subject ?? "").slice(0, 200) || "Oppfølging",
      text: String(input.body ?? ""),
    });
    console.log("[EMAIL_SENT]", { to: to.slice(0, 3) + "…" });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[EMAIL_SEND_FAIL]", msg);
    return { ok: false, error: msg.slice(0, 200) };
  }
}
