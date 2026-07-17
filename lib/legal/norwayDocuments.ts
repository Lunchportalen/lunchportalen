/**
 * Phase 16NO.2 — Norway operational legal documents (nb-NO).
 * NORWAY_LEGAL_STATUS = OWNER_APPROVED_EXTERNAL_REVIEW_PENDING
 * Never claim LEGAL_APPROVED / lawyer / accountant / regulator certification.
 */

import { createHash } from "node:crypto";
import type { LegalDocumentType } from "@/lib/legal/legalDocumentRegistry";

export const NORWAY_LEGAL_STATUS = "OWNER_APPROVED_EXTERNAL_REVIEW_PENDING" as const;
export const NORWAY_LEGAL_LOCALE = "nb-NO" as const;
export const NORWAY_LEGAL_COUNTRY = "NO" as const;
export const NORWAY_LEGAL_VERSION = "1.0.0-owner-2026-07-17" as const;
export const NORWAY_LEGAL_EFFECTIVE_DATE = "2026-07-17" as const;

export type NorwaySubjectRole = "provider" | "company" | "employee";

export type NorwayLegalDocument = {
  documentType: LegalDocumentType;
  version: string;
  effectiveDate: string;
  locale: typeof NORWAY_LEGAL_LOCALE;
  countryCode: typeof NORWAY_LEGAL_COUNTRY;
  title: string;
  body: string;
  checksum: string;
  norwayLegalStatus: typeof NORWAY_LEGAL_STATUS;
};

const COMMON_COMMERCIAL = `
## Kommersiell modell (låst)

1. Cateringfirmaet er selger av maten og fakturerer sin egen kunde.
2. Lunchportalen er plattformtjenesteleverandør og selger ikke mat.
3. Lunchportalen fakturerer ikke matkunden og mottar ikke betaling for matsalget.
4. Lunchportalen fakturerer kun cateringfirmaet provisjon: 5 % av netto ordreverdi ekskl. kundens merverdiavgift.
5. Mat inklusive levering organisert av cateringfirmaet behandles skattemessig hos cateringfirmaet (typisk 15 % MVA på mat).
6. Plattformprovisjon er tjeneste hos Lunchportalen (typisk 25 % MVA når Lunchportalen er registrert i Merverdiavgiftsregisteret).
7. Stripe er av.
8. Denne teksten er eiergodkjent for norsk drift. Den er ikke ekstern juridisk godkjenning, advokatgodkjenning, regnskapsgodkjenning eller myndighetssertifisering.
`.trim();

function doc(
  documentType: LegalDocumentType,
  title: string,
  sections: string[],
): NorwayLegalDocument {
  const body = [
    `# ${title}`,
    ``,
    `Versjon: ${NORWAY_LEGAL_VERSION}`,
    `Ikrafttredelse: ${NORWAY_LEGAL_EFFECTIVE_DATE}`,
    `Land: Norge`,
    `Språk: nb-NO`,
    `Status: ${NORWAY_LEGAL_STATUS}`,
    ``,
    ...sections,
    ``,
    COMMON_COMMERCIAL,
  ].join("\n");
  return {
    documentType,
    version: NORWAY_LEGAL_VERSION,
    effectiveDate: NORWAY_LEGAL_EFFECTIVE_DATE,
    locale: NORWAY_LEGAL_LOCALE,
    countryCode: NORWAY_LEGAL_COUNTRY,
    title,
    body,
    checksum: createHash("sha256").update(body, "utf8").digest("hex"),
    norwayLegalStatus: NORWAY_LEGAL_STATUS,
  };
}

export const NORWAY_REQUIRED_DOCS_BY_ROLE: Record<NorwaySubjectRole, readonly LegalDocumentType[]> = {
  provider: [
    "provider_terms",
    "invoice_payment_terms",
    "allergen_food_responsibility",
    "privacy_notice",
    "dpa",
  ],
  company: ["company_terms", "cancellation_refund", "privacy_notice"],
  employee: ["employee_terms", "privacy_notice"],
};

export function buildNorwayLegalDocuments(): NorwayLegalDocument[] {
  return [
    doc("provider_terms", "Avtale for cateringfirma (leverandør)", [
      "## Partene",
      "Avtalen gjelder mellom Lunchportalen AS (plattform) og cateringfirmaet (leverandør).",
      "## Leverandørens ansvar",
      "- Meny, priser, allergener, kvalitet og mattrygghet.",
      "- Korrekt matskatt og kundebehandling av merverdiavgift.",
      "- Levering organisert eller levert av cateringfirmaet.",
      "- Fakturering av egen kunde for maten.",
      "## Plattformens rolle",
      "Lunchportalen leverer tilgang til og bruk av plattformen. Lunchportalen er ikke selger av mat.",
      "## Provisjon",
      "Cateringfirmaet betaler Lunchportalen 5 % av netto ordreverdi ekskl. kundens merverdiavgift for plattformtjenesten.",
    ]),
    doc("company_terms", "Vilkår for bedriftskunde", [
      "## Partene",
      "Avtalen gjelder mellom bedriften (kunde) og Lunchportalen AS for bruk av bestillingsplattformen.",
      "## Bestilling",
      "Ansatte bestiller via Lunchportalen. Maten leveres av tilknyttet cateringfirma.",
      "## Betaling for mat",
      "Cateringfirmaet fakturerer bedriften for maten. Lunchportalen mottar ikke betaling for matsalget.",
      "## Plattform",
      "Lunchportalen er plattformtjeneste og selger ikke maten.",
    ]),
    doc("employee_terms", "Vilkår for sluttbruker (ansatt)", [
      "## Bruk",
      "Du bruker Lunchportalen for å bestille firmalunsj på vegne av din arbeidsgiver.",
      "## Mat og allergener",
      "Informasjon om meny og allergener kommer fra cateringfirmaet. Meld fra ved usikkerhet.",
      "## Personvern",
      "Se personvernerklæringen for behandling av personopplysninger.",
    ]),
    doc("privacy_notice", "Personvernerklæring", [
      "## Behandlingsansvarlig",
      "Lunchportalen AS, org.nr 937 155 239, behandler personopplysninger for å levere plattformtjenesten.",
      "## Formål",
      "Konto, bestilling, leveransekoordinering, support og lovpålagt regnskap/revisjon der relevant.",
      "## Rettigheter",
      "Du kan be om innsyn, retting, sletting og begrensning i tråd med gjeldende personvernregelverk.",
      "## Leverandører",
      "Vi bruker underleverandører (for eksempel hosting og e-post) under databehandleravtaler.",
    ]),
    doc("dpa", "Databehandleravtale (plattform)", [
      "## Rolle",
      "Når Lunchportalen behandler personopplysninger på vegne av bedrift eller cateringfirma, gjelder denne databehandleravtalen.",
      "## Instruks",
      "Behandling skjer kun etter dokumentert instruks og for å levere plattformtjenesten.",
      "## Sikkerhet",
      "Tekniske og organisatoriske tiltak skal sikre konfidensialitet, integritet og tilgjengelighet.",
      "## Underleverandører",
      "Bruk av underdatabehandlere skal være sporende og kontraktsbundet.",
    ]),
    doc("cancellation_refund", "Avbestilling og refusjon", [
      "## Bestillingsfrist",
      "Endring og avbestilling følger markeds- og bedriftsspesifikk cutoff (typisk kl. 08:00 lokal tid dagen før levering med mindre annet er avtalt).",
      "## Etter cutoff",
      "Etter cutoff kan bestilling være låst. Eventuell refusjon følger avtale mellom bedrift og cateringfirma for maten.",
      "## Plattformprovisjon",
      "Provisjon beregnes av netto ordreverdi. Kansellering som reversérer ordren skal reversére provisjonsgrunnlag proporsjonalt.",
    ]),
    doc("allergen_food_responsibility", "Ansvar for meny, allergener, priser og matskatt", [
      "## Cateringfirmaets ansvar",
      "Cateringfirmaet er alene ansvarlig for menyinnhold, priser, allergenmerking, mattrygghet, levering og korrekt matskatt/kunde-MVA.",
      "## Lunchportalen",
      "Lunchportalen formidler bestillingsdata og er ikke produsent eller selger av maten.",
    ]),
    doc("invoice_payment_terms", "Faktura- og provisjonsvilkår for cateringfirma", [
      "## Kundens matfaktura",
      "Cateringfirmaet fakturerer egen kunde for maten.",
      "## Plattformfaktura",
      "Lunchportalen fakturerer cateringfirmaet 5 % av netto ordreverdi ekskl. kundens merverdiavgift.",
      "## MVA på plattformprovisjon",
      "Reell MVA på plattformfaktura krever at Lunchportalen AS er registrert i Merverdiavgiftsregisteret. Inntil da utstedes ikke reell MVA-faktura.",
    ]),
  ];
}

export function getNorwayDocument(documentType: LegalDocumentType): NorwayLegalDocument | null {
  return buildNorwayLegalDocuments().find((d) => d.documentType === documentType) ?? null;
}

export function requiredNorwayDocumentsForRole(role: NorwaySubjectRole): NorwayLegalDocument[] {
  const types = NORWAY_REQUIRED_DOCS_BY_ROLE[role];
  return types.map((t) => {
    const d = getNorwayDocument(t);
    if (!d) throw new Error(`NORWAY_DOC_MISSING:${t}`);
    return d;
  });
}

export function assertNorwayDocsNotForgedLegalApproved(): void {
  // Hard lock: these owner docs must never be labeled LEGAL_APPROVED in this pack.
  for (const d of buildNorwayLegalDocuments()) {
    if ((d as { reviewerStatus?: string }).reviewerStatus === "LEGAL_APPROVED") {
      throw new Error("FORGED_LEGAL_APPROVAL_IN_NORWAY_PACK");
    }
    if (d.norwayLegalStatus !== NORWAY_LEGAL_STATUS) {
      throw new Error("NORWAY_LEGAL_STATUS_DRIFT");
    }
  }
}
