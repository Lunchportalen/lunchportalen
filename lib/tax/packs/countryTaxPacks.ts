/**
 * Phase 15G — tax pack registry for all 21 countries.
 *
 * IMPORTANT: Packs are RESEARCHED scaffolding with official primary-source URLs.
 * reviewStatus is NEVER APPROVED here. Human tax reviewers must approve.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export type TaxPackReviewStatus = "RESEARCHED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type OfficialSource = {
  authorityName: string;
  sourceUrl: string;
  sourceTitle: string;
  legalReference?: string;
};

export type CountryTaxPack = {
  countryCode: CountryCode;
  taxStrategy: "vat" | "sales_tax" | "gst";
  reviewStatus: TaxPackReviewStatus;
  officialSources: readonly OfficialSource[];
  openQuestions: readonly string[];
  /** US/CA only: subdivision coverage summary */
  subdivisionCoverage?: {
    required: true;
    supportedCount: number;
    blockedMissingEvidenceCount: number;
    notApplicableCount: number;
  };
};

const TEDB: OfficialSource = {
  authorityName: "European Commission — Taxation and Customs Union",
  sourceUrl: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates_en",
  sourceTitle: "VAT Rates (TEDB / VAT Directive framework)",
  legalReference: "Council Directive 2006/112/EC as amended; TEDB Member State notifications",
};

const VIES: OfficialSource = {
  authorityName: "European Commission VIES",
  sourceUrl: "https://ec.europa.eu/taxation_customs/vies/",
  sourceTitle: "VIES VAT number validation",
};

function euPack(countryCode: CountryCode, nationalAuthority: OfficialSource): CountryTaxPack {
  return {
    countryCode,
    taxStrategy: "vat",
    reviewStatus: "RESEARCHED",
    officialSources: [TEDB, VIES, nationalAuthority],
    openQuestions: [
      "Confirm reduced vs standard rates for cold food, hot takeaway, and staffed catering from national primary law.",
      "Confirm reverse-charge applicability for B2B cross-border vs domestic.",
      "Confirm invoice wording and e-invoice mandate effective dates.",
    ],
  };
}

export const COUNTRY_TAX_PACKS: Record<CountryCode, CountryTaxPack> = {
  NO: {
    countryCode: "NO",
    taxStrategy: "vat",
    reviewStatus: "RESEARCHED",
    officialSources: [
      {
        authorityName: "Skatteetaten",
        sourceUrl: "https://www.skatteetaten.no/satser/merverdiavgift/",
        sourceTitle: "Merverdiavgiftssatser",
        legalReference: "Merverdiavgiftsloven",
      },
      TEDB,
    ],
    openQuestions: [
      "Confirm current sats for servering vs takeaway vs catering from Skatteetaten primary pages.",
    ],
  },
  SE: euPack("SE", {
    authorityName: "Skatteverket",
    sourceUrl: "https://www.skatteverket.se/",
    sourceTitle: "Skatteverket — moms",
  }),
  DK: euPack("DK", {
    authorityName: "Skattestyrelsen",
    sourceUrl: "https://skat.dk/",
    sourceTitle: "Skattestyrelsen — moms",
  }),
  FI: euPack("FI", {
    authorityName: "Vero / Finnish Tax Administration",
    sourceUrl: "https://www.vero.fi/",
    sourceTitle: "Value added tax",
  }),
  GB: {
    countryCode: "GB",
    taxStrategy: "vat",
    reviewStatus: "RESEARCHED",
    officialSources: [
      {
        authorityName: "HM Revenue & Customs",
        sourceUrl: "https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091",
        sourceTitle: "Catering, takeaway food (VAT Notice 709/1)",
      },
      {
        authorityName: "HM Revenue & Customs",
        sourceUrl: "https://www.gov.uk/guidance/vat-rates-on-different-goods-and-services",
        sourceTitle: "VAT rates on different goods and services",
      },
    ],
    openQuestions: [
      "Confirm edge cases for cold takeaway exceptions (confectionery, soft drinks) under Notice 701/14.",
    ],
  },
  DE: euPack("DE", {
    authorityName: "Bundesministerium der Finanzen / BZSt",
    sourceUrl: "https://www.bundesfinanzministerium.de/",
    sourceTitle: "Umsatzsteuer",
  }),
  FR: euPack("FR", {
    authorityName: "Direction générale des Finances publiques",
    sourceUrl: "https://www.impots.gouv.fr/",
    sourceTitle: "TVA",
  }),
  ES: euPack("ES", {
    authorityName: "Agencia Tributaria",
    sourceUrl: "https://sede.agenciatributaria.gob.es/",
    sourceTitle: "IVA",
  }),
  IT: euPack("IT", {
    authorityName: "Agenzia delle Entrate",
    sourceUrl: "https://www.agenziaentrate.gov.it/",
    sourceTitle: "IVA",
  }),
  NL: euPack("NL", {
    authorityName: "Belastingdienst",
    sourceUrl: "https://www.belastingdienst.nl/",
    sourceTitle: "Btw-tarieven",
  }),
  BE: euPack("BE", {
    authorityName: "FPS Finance",
    sourceUrl: "https://finance.belgium.be/",
    sourceTitle: "VAT rates",
  }),
  CH: {
    countryCode: "CH",
    taxStrategy: "vat",
    reviewStatus: "RESEARCHED",
    officialSources: [
      {
        authorityName: "Eidgenössische Steuerverwaltung ESTV / FTA",
        sourceUrl: "https://www.estv.admin.ch/",
        sourceTitle: "Mehrwertsteuer / TVA / IVA",
      },
    ],
    openQuestions: ["Confirm CHF rounding and catering rates from ESTV primary notices."],
  },
  AT: euPack("AT", {
    authorityName: "Bundesministerium für Finanzen",
    sourceUrl: "https://www.bmf.gv.at/",
    sourceTitle: "Umsatzsteuer",
  }),
  IE: euPack("IE", {
    authorityName: "Revenue Commissioners",
    sourceUrl: "https://www.revenue.ie/",
    sourceTitle: "VAT rates",
  }),
  PL: euPack("PL", {
    authorityName: "Ministerstwo Finansów / KAS",
    sourceUrl: "https://www.podatki.gov.pl/",
    sourceTitle: "VAT",
  }),
  RO: euPack("RO", {
    authorityName: "ANAF",
    sourceUrl: "https://www.anaf.ro/",
    sourceTitle: "TVA",
  }),
  CZ: euPack("CZ", {
    authorityName: "Finanční správa",
    sourceUrl: "https://www.financnisprava.cz/",
    sourceTitle: "DPH",
  }),
  PT: euPack("PT", {
    authorityName: "Autoridade Tributária e Aduaneira",
    sourceUrl: "https://www.portaldasfinancas.gov.pt/",
    sourceTitle: "IVA",
  }),
  GR: euPack("GR", {
    authorityName: "ΑΑΔΕ / Independent Authority for Public Revenue",
    sourceUrl: "https://www.aade.gr/",
    sourceTitle: "ΦΠΑ",
  }),
  US: {
    countryCode: "US",
    taxStrategy: "sales_tax",
    reviewStatus: "RESEARCHED",
    officialSources: [
      {
        authorityName: "Streamlined Sales Tax Governing Board (reference) + state DORs",
        sourceUrl: "https://www.streamlinedsalestax.org/",
        sourceTitle: "Streamlined Sales Tax — state participation varies",
      },
    ],
    openQuestions: [
      "Per-state nexus, marketplace facilitator, and prepared-food rules must be evidenced from each state DOR.",
      "No single national sales-tax rate may be used.",
    ],
    subdivisionCoverage: {
      required: true,
      supportedCount: 0,
      blockedMissingEvidenceCount: 51, // 50 states + DC
      notApplicableCount: 0,
    },
  },
  CA: {
    countryCode: "CA",
    taxStrategy: "gst",
    reviewStatus: "RESEARCHED",
    officialSources: [
      {
        authorityName: "Canada Revenue Agency",
        sourceUrl: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html",
        sourceTitle: "GST/HST for businesses",
      },
    ],
    openQuestions: [
      "Confirm GST/HST/PST/QST place-of-supply for catering per province from CRA + provincial statutes.",
    ],
    subdivisionCoverage: {
      required: true,
      supportedCount: 0,
      blockedMissingEvidenceCount: 13, // 10 provinces + 3 territories
      notApplicableCount: 0,
    },
  },
};

export function assertAllTaxPacksPresent(): void {
  for (const code of SUPPORTED_COUNTRY_CODES) {
    if (!COUNTRY_TAX_PACKS[code]) {
      throw new Error(`TAX_PACK_MISSING:${code}`);
    }
  }
}

export function countTaxPacksByStatus(): Record<TaxPackReviewStatus, number> {
  const out: Record<TaxPackReviewStatus, number> = {
    RESEARCHED: 0,
    PENDING_REVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const code of SUPPORTED_COUNTRY_CODES) {
    out[COUNTRY_TAX_PACKS[code].reviewStatus] += 1;
  }
  return out;
}
