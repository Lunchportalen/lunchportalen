import "server-only";

import { sendEmail } from "@/lib/integrations/email";

export type FollowUpLead = {
  email?: unknown;
};

/**
 * Valgfri oppfølgings-e-post til lead (kun når e-post finnes og Resend er konfigurert).
 */
export async function sendFollowUp(lead: FollowUpLead) {
  const email = typeof lead.email === "string" ? lead.email.trim() : "";
  if (!email || !email.includes("@")) {
    return { ok: false as const, reason: "no_valid_email" };
  }

  return sendEmail({
    to: email,
    subject: "Oppfølging",
    body: "Hei! Skal vi ta en prat?",
  });
}
