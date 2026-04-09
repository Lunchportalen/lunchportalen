// STATUS: KEEP

import "server-only";

import type { AgreementContextResult } from "@/lib/agreement/loadAgreementContext";

type GateSeverity = "info" | "warning" | "critical";

export function isActive(ctx: AgreementContextResult): boolean {
  return ctx.ok === true && ctx.blocked === false && ctx.companyStatus === "ACTIVE" && ctx.agreementStatus === "ACTIVE";
}

export function blockedReasonToUi(reason: string | null | undefined): {
  title: string;
  body: string;
  severity: GateSeverity;
} {
  const code = String(reason ?? "").trim().toUpperCase();

  if (code === "NO_SESSION") {
    return {
      title: "Du er ikke logget inn",
      body: "Logg inn for å fortsette.",
      severity: "warning",
    };
  }

  if (code === "COMPANY_NOT_ACTIVE") {
    return {
      title: "Firma er ikke aktivt",
      body: "Tilgang er midlertidig blokkert for firmaet.",
      severity: "critical",
    };
  }

  if (code === "AGREEMENT_NOT_ACTIVE") {
    return {
      title: "Avtalen er ikke aktiv",
      body: "Bestilling er tilgjengelig når avtalen er aktivert.",
      severity: "warning",
    };
  }

  if (code === "AGREEMENT_MISSING_OR_UNKNOWN") {
    return {
      title: "Avtale mangler",
      body: "Kunne ikke finne en gyldig avtale for firmaet.",
      severity: "critical",
    };
  }

  return {
    title: "Tilgang blokkert",
    body: "Tilgangen er blokkert av sikkerhetsregler.",
    severity: "critical",
  };
}

