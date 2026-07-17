/**
 * Phase 16NO.4 — registration evidence packet (prepared automatically; never auto-submitted).
 */
import type { NorwayMvaDashboardSnapshot } from "@/lib/markets/norwayMvaController";
import { checksumThresholdCalculation } from "@/lib/markets/norwayMvaTurnover";

export type NorwayMvaRegistrationEvidencePacket = {
  legalName: "Lunchportalen AS";
  organisationNumber: string;
  rollingTwelveMonth: {
    windowStart: string;
    windowEnd: string;
    recognizedTaxableTurnoverMinor: string;
    invoicedCommissionTurnoverMinor: string;
    recognizedButUninvoicedMinor: string;
  };
  includedCommissionEventIds: string[];
  crossingEventId: string | null;
  dateThresholdExceeded: string | null;
  officialRegistrationInstructionsNb: string[];
  officialCompanyStatus: NorwayMvaDashboardSnapshot["officialCheck"];
  immutableEvidenceChecksum: string;
  ownerAction: "NONE" | "MVA_REGISTRATION_OWNER_ACTION_REQUIRED";
};

export function buildNorwayMvaRegistrationEvidencePacket(
  dash: NorwayMvaDashboardSnapshot,
): NorwayMvaRegistrationEvidencePacket {
  const needsOwner =
    !dash.mvaRegistered &&
    (dash.status === "CROSSING_EVENT_DETECTED" ||
      dash.status === "REGISTRATION_REQUIRED" ||
      dash.status === "REGISTRATION_PENDING" ||
      dash.crossingEventId != null);

  return {
    legalName: "Lunchportalen AS",
    organisationNumber: dash.orgnr,
    rollingTwelveMonth: {
      windowStart: dash.windowStart,
      windowEnd: dash.windowEnd,
      recognizedTaxableTurnoverMinor: dash.recognizedTaxableTurnoverMinor,
      invoicedCommissionTurnoverMinor: dash.invoicedCommissionTurnoverMinor,
      recognizedButUninvoicedMinor: dash.recognizedButUninvoicedMinor,
    },
    includedCommissionEventIds: dash.includedEventIds,
    crossingEventId: dash.crossingEventId,
    dateThresholdExceeded: dash.crossingEventId ? dash.asOf : null,
    officialRegistrationInstructionsNb: [
      "Logg inn hos Skatteetaten / Altinn for registrering i Merverdiavgiftsregisteret.",
      "Bruk organisasjonsnummer for Lunchportalen AS.",
      "Systemet sender ikke søknad automatisk.",
      "Etter registrering verifiserer systemet status via Brønnøysundregistrene daglig.",
    ],
    officialCompanyStatus: dash.officialCheck,
    immutableEvidenceChecksum: checksumThresholdCalculation({
      windowStartIso: dash.windowStart,
      windowEndIso: dash.windowEnd,
      recognizedMinor: dash.recognizedTaxableTurnoverMinor,
      invoicedMinor: dash.invoicedCommissionTurnoverMinor,
      includedEventIds: dash.includedEventIds,
      status: `EVIDENCE:${dash.status}`,
    }),
    ownerAction: needsOwner ? "MVA_REGISTRATION_OWNER_ACTION_REQUIRED" : "NONE",
  };
}
