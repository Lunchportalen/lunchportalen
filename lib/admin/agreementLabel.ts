import type { AgreementStatusResult, Tier } from "@/lib/auth/agreementStatus";

const TIER_LABELS: Record<Tier, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

const TIER_ORDER: Tier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

function formatStatusLabel(status: AgreementStatusResult["status"]) {
  if (status === "ACTIVE") return "Aktiv";
  if (status === "PAUSED") return "Pauset";
  if (status === "CLOSED") return "Avsluttet";
  if (status === "PENDING") return "Avventer";
  if (status === "REJECTED") return "Avvist";
  return "Ukjent";
}

export function formatAgreementSystemLabel(status: AgreementStatusResult): string {
  if (!status.isActive && !status.agreementId) {
    return "Ingen aktiv";
  }

  const tierCounts: Record<Tier, number> = {
    BASIS: 0,
    LUXUS: 0,
    ENTERPRISE: 0,
  };

  for (const tier of Object.values(status.dayTiers)) {
    if (tier) tierCounts[tier] += 1;
  }

  const statusLabel = formatStatusLabel(status.status);
  const activeTiers = TIER_ORDER.filter((tier) => tierCounts[tier] > 0);

  if (activeTiers.length === 0) {
    return `Ikke spesifisert · ${statusLabel}`;
  }

  if (activeTiers.length === 1) {
    return `${TIER_LABELS[activeTiers[0]]} · ${statusLabel}`;
  }

  const parts = activeTiers.map((tier) => {
    const count = tierCounts[tier];
    const dayWord = count === 1 ? "dag" : "dager";
    return `${count} ${dayWord} ${TIER_LABELS[tier]}`;
  });

  return `Blandet (${parts.join(", ")}) · ${statusLabel}`;
}

export function formatSystemPaymentLabel() {
  return "Ikke aktivert";
}
