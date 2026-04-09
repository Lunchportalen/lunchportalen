/**
 * E-post: ingen skjult bulk — kun eksplisitt godkjent innhold.
 * Integrasjon mot SMTP/Mailchimp/Resend kan kobles inn her (server route anbefalt).
 */

export type SendEmailPayload = {
  to: string;
  subject: string;
  body: string;
  /** Må være true — ellers ingen sideeffekt */
  explicitUserApproved: boolean;
};

export type SendEmailResult = {
  ok: boolean;
  message: string;
};

/**
 * I denne klient-sikre bygget: ingen direkte leverandør-kall.
 * Bruk mailto: i UI eller egen server-route med secrets.
 */
export async function sendEmail(emailData: SendEmailPayload): Promise<SendEmailResult> {
  if (emailData.explicitUserApproved !== true) {
    return { ok: false, message: "Mangler eksplisitt godkjenning — ingen e-post sendt." };
  }
  const to = String(emailData.to ?? "").trim();
  if (!to || !to.includes("@")) {
    return { ok: false, message: "Ugyldig mottaker — fyll inn e-post først." };
  }

  return {
    ok: false,
    message:
      "E-postleverandør er ikke konfigurert i denne bygget. Bruk «Åpne e-postklient» (mailto) eller eksporter teksten manuelt.",
  };
}
