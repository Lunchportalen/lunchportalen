/**
 * Bransje + rolle: eksplisitte intros (ingen generisk «alle» når kombinasjon er kjent).
 */

import type { Industry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";

export function getIndustryRoleIntro(industry: Industry, role: Role): string {
  if (industry === "it" && role === "hr") {
    return "Som HR i en IT-bedrift vet du hvor viktig trivsel er.";
  }

  if (industry === "construction" && role === "manager") {
    return "Som leder på byggeplass vet du hvor viktig god lunsj er.";
  }

  if (industry === "office" && role === "office") {
    return "Som ansvarlig for kontoret vet du hvor mye tid lunsj tar.";
  }

  if (industry === "healthcare" && role === "hr") {
    return "Som HR i helse vet du at skift og pauser må fungere hver dag.";
  }

  if (industry === "public" && role === "procurement") {
    return "Som innkjøp i offentlig sektor trenger du avtaler som tåler kontroll.";
  }

  if (industry === "finance" && role === "manager") {
    return "Som leder i finans vet du at forutsigbarhet slår ad hoc bestilling.";
  }

  if (role === "procurement") {
    return "Som innkjøpsansvarlig trenger du ryddige rammer og dokumentasjon.";
  }

  if (role === "hr") {
    return "Som HR-ansvarlig vet du at felles måltider påvirker arbeidsmiljøet.";
  }

  if (role === "manager") {
    return "Som leder vet du at teamet trenger forutsigbarhet — også rundt lunsj.";
  }

  return "Som ansvarlig for lunsj i bedriften";
}

/** Brukes i CEO-setninger («HR i IT-bedrifter …»). */
export function industrySegmentNorwegianPhrase(industry: Industry): string {
  switch (industry) {
    case "it":
      return "IT-bedrifter";
    case "construction":
      return "bedrifter i bygg og anlegg";
    case "office":
      return "kontormiljøer";
    case "healthcare":
      return "helseaktører";
    case "public":
      return "offentlig sektor";
    case "finance":
      return "finansmiljøer";
    default: {
      const _e: never = industry;
      return _e;
    }
  }
}

export function roleResponderHeadline(role: Role): string {
  switch (role) {
    case "hr":
      return "HR";
    case "manager":
      return "Ledere";
    case "office":
      return "Kontoransvarlige";
    case "procurement":
      return "Innkjøp";
    default: {
      const _e: never = role;
      return _e;
    }
  }
}

/** Kort rolle-navn i lister (f.eks. kalender-rad). */
export function roleUiShortLabel(role: Role): string {
  switch (role) {
    case "hr":
      return "HR";
    case "manager":
      return "Leder";
    case "office":
      return "Kontor";
    case "procurement":
      return "Innkjøp";
    default: {
      const _e: never = role;
      return _e;
    }
  }
}
