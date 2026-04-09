import "server-only";

import { RESEND_DEFAULT_FROM } from "@/lib/system/emails";
import { opsLog } from "@/lib/ops/log";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  body: string;
};

export type SendEmailResult =
  | { ok: true }
  | { ok: false; reason: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resend-e-post (valgfritt). Uten `RESEND_API_KEY` returneres fail — hovedflyten skal ikke avhenge av dette.
 */
export async function sendEmail({ to, subject, body }: SendEmailInput): Promise<SendEmailResult> {
  try {
    console.log("[EMAIL]", { to, subject });

    if (!process.env.RESEND_API_KEY) {
      return { ok: false, reason: "no_api_key" };
    }

    const from =
      typeof process.env.RESEND_FROM === "string" && process.env.RESEND_FROM.trim().length > 0
        ? process.env.RESEND_FROM.trim()
        : RESEND_DEFAULT_FROM;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html: `<p>${escapeHtml(body)}</p>`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[EMAIL] resend_http_error", res.status, text);
      opsLog("integration_email", { channel: "resend", ok: false, reason: "http_error", status: res.status });
      return { ok: false, reason: "http_error" };
    }

    opsLog("integration_email", { channel: "resend", ok: true });
    return { ok: true };
  } catch (e) {
    console.error("[EMAIL]", e);
    opsLog("integration_email", { channel: "resend", ok: false, reason: "exception" });
    return { ok: false, reason: "exception" };
  }
}
