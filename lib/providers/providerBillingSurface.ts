// lib/providers/providerBillingSurface.ts
// Provider-facing helpers for /leverandor/faktura (i18n keys + locale formatting).
//
// Prinsipp:
// - UI-copy lives in messages/provider.billing.* — this module exposes ids and keys only.
// - «Oppgjør» brukes presist: leverandørens oppgjør/fakturagrunnlag mot Lunchportalen.
// - Provisjonsmodellen (5 % per solgte porsjon) omtales kun som produktcopy i messages.
//   Ingen beregning gjøres her — backend-data for provisjonssats finnes ikke ennå.
// - Aldri rå enums/ISO-datoer i brukerrettet UI.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { invoiceStatusKey, providerPlanKey, type InvoiceStatusKey } from "@/lib/providers/providerBillingShared";

export type BillingTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type BillingSummaryCardId = "settlementStatus" | "commission" | "nextSettlement";

export type BillingSummaryCard = {
  id: BillingSummaryCardId;
  label: string;
  value: string;
  hint: string | null;
};

export type SettlementStatusKey = "active" | "notActivated";

export function settlementStatusKey(hasActiveSubscription: boolean): SettlementStatusKey {
  return hasActiveSubscription ? "active" : "notActivated";
}

/** Provider-safe oppgjørsstatus — basert på om aktiv oppgjørsavtale finnes i data. */
export function settlementStatusLabel(hasActiveSubscription: boolean, t: BillingTranslator): string {
  return t(`status.settlement.${settlementStatusKey(hasActiveSubscription)}`);
}

/** Provider-safe fakturastatus — aldri rå enum i UI. */
export function invoiceStatusLabel(status: unknown, t: BillingTranslator): string {
  const key: InvoiceStatusKey = invoiceStatusKey(status);
  return t(`status.invoice.${key}`);
}

/** Provider-safe plan label — falls back to raw plan code when unknown. */
export function providerPlanLabel(plan: unknown, t: BillingTranslator): string {
  const key = providerPlanKey(plan);
  return key ? t(`plan.${key}`) : String(plan ?? "").trim();
}

/**
 * Rolige summary cards fra eksisterende read-data — ingen nye queries, ingen fake tall.
 * Provisjonssats og neste oppgjør finnes ikke i read model ennå og vises derfor
 * med kontrollerte, ærlige verdier.
 */
export function buildBillingSummaryCards(
  input: { hasActiveSubscription: boolean },
  t: BillingTranslator,
): BillingSummaryCard[] {
  const active = input.hasActiveSubscription === true;
  return [
    {
      id: "settlementStatus",
      label: t("summary.settlementStatus"),
      value: settlementStatusLabel(active, t),
      hint: active ? null : t("summary.activateHint"),
    },
    {
      id: "commission",
      label: t("summary.commission"),
      value: t("summary.commissionPending"),
      hint: null,
    },
    {
      id: "nextSettlement",
      label: t("summary.nextSettlement"),
      value: t("summary.nextSettlementNone"),
      hint: null,
    },
  ];
}
