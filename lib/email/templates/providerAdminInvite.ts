import type { AppLocale } from "@/lib/i18n/middlewareLocale";

type Copy = {
  subject: string;
  greeting: (n: string) => string;
  intro: (company: string) => string;
  lead: string;
  cta: string;
  expiry: string;
  signoff: string;
};

const NB: Copy = {
  subject: "Aktiver leverandørkontoen din \u2013 Lunchportalen",
  greeting: (n) => `Hei ${n},`,
  intro: (c) => `Søknaden for ${c} er godkjent. Opprett innloggingen din for å komme i gang som cateringleverandør.`,
  lead: "Klikk på knappen nedenfor for å aktivere administratorkontoen:",
  cta: "Aktiver leverandørkonto",
  expiry: "Lenken er gyldig i 7 dager.",
  signoff: "Med vennlig hilsen,\nLunchportalen-teamet",
};

const EN: Copy = {
  subject: "Activate your provider account \u2013 Lunchportalen",
  greeting: (n) => `Hi ${n},`,
  intro: (c) => `The application for ${c} has been approved. Create your login to get started as a catering provider.`,
  lead: "Click the button below to activate the admin account:",
  cta: "Activate provider account",
  expiry: "The link is valid for 7 days.",
  signoff: "Best regards,\nThe Lunchportalen team",
};

function copy(locale: AppLocale | string | null | undefined): Copy {
  const raw = String(locale ?? "").trim();
  if (raw === "nb" || raw === "") return NB;
  return EN;
}

export function buildProviderAdminInviteEmail(params: {
  contactName: string;
  companyName: string;
  activateUrl: string;
  locale?: AppLocale | string | null;
}): { subject: string; html: string; text: string } {
  const c = copy(params.locale);
  const { contactName, companyName, activateUrl } = params;

  const html = `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.subject}</title></head>
<body style="margin:0;padding:0;background-color:#1a1714;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1714;"><tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#242019;border-radius:16px;overflow:hidden;">
<tr><td style="padding:40px;">
<h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#ffffff;">${c.subject}</h1>
<p style="margin:0 0 20px;font-size:16px;color:#c8b99a;line-height:1.6;">${c.greeting(contactName)}</p>
<p style="margin:0 0 24px;font-size:16px;color:#c8b99a;line-height:1.6;">${c.intro(companyName)}</p>
<p style="margin:0 0 28px;font-size:16px;color:#c8b99a;line-height:1.6;">${c.lead}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;"><tr><td align="center">
<a href="${activateUrl}" style="display:inline-block;background-color:#f5c842;color:#1a1714;font-size:16px;font-weight:800;text-decoration:none;padding:16px 36px;border-radius:999px;">${c.cta}</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:13px;color:#6b5f4a;">${c.expiry}</p>
<p style="margin:24px 0 0;font-size:15px;color:#c8b99a;line-height:1.6;">${c.signoff.split("\n")[0]}<br><strong style="color:#ffffff;">${c.signoff.split("\n").slice(1).join(" ")}</strong></p>
</td></tr></table></td></tr></table></body></html>`;

  const text = `${c.subject}

${c.greeting(contactName)}

${c.intro(companyName)}

${c.lead}
${activateUrl}

${c.expiry}

${c.signoff}`;

  return { subject: c.subject, html, text };
}
