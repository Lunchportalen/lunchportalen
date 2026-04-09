// STATUS: KEEP

// lib/email/templates.ts
function safeName(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "der";
}

export function activationEmail(params: {
  companyName: string;
  contactName?: string;
  loginUrl: string;
  supportEmail: string;
}) {
  const name = safeName(params.contactName);
  const company = String(params.companyName ?? "").trim() || "firmaet deres";

  return {
    subject: "Velkommen til Lunchportalen – avtalen er aktivert",
    text:
`Hei ${name},

Takk for registreringen. Avtalen for ${company} er nå aktivert.

Neste steg:
1) Logg inn her: ${params.loginUrl}
2) Gå til Admin og legg til ansatte

Har dere spørsmål eller ønsker rask oppstart, svar gjerne på denne e-posten eller kontakt oss på ${params.supportEmail}.

Vennlig hilsen
Lunchportalen`,
  };
}

export function rejectionEmail(params: {
  companyName: string;
  contactName?: string;
  supportEmail: string;
}) {
  const name = safeName(params.contactName);
  const company = String(params.companyName ?? "").trim() || "firmaet deres";

  return {
    subject: "Lunchportalen – svar på registrering",
    text:
`Hei ${name},

Takk for forespørselen. Vi har dessverre ikke kapasitet til å ta inn ${company} på nåværende tidspunkt.

Dersom dere ønsker, kan dere svare på denne e-posten eller ta kontakt på ${params.supportEmail}, så kan vi se på muligheter fremover.

Vennlig hilsen
Lunchportalen`,
  };
}
