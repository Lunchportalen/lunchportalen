// lib/providers/providerBillingSurface.ts
// Provider-facing copy og rene presentasjonshelpers for /leverandor/faktura.
//
// Prinsipp:
// - All ny copy samles her (én kilde, klar for senere i18n) — ingen spredte strenger.
// - «Oppgjør» brukes presist: dette er leverandørens oppgjør/fakturagrunnlag mot
//   Lunchportalen — ikke bedriftskundenes fakturaer.
// - Provisjonsmodellen (5 % per solgte porsjon) omtales kun som produktcopy.
//   Ingen beregning gjøres her — backend-data for provisjonssats finnes ikke ennå.
// - Aldri rå enums/ISO-datoer i brukerrettet UI.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { INVOICE_STATUS_LABELS } from "@/lib/providers/providerBillingShared";

export const PROVIDER_BILLING_COPY = {
  eyebrow: "Leverandør",
  heading: "Faktura og oppgjør",
  subheading: "Oversikt over fakturagrunnlag, provisjon og oppgjør mellom leverandøren og Lunchportalen.",
  activeAgreementEyebrow: "Aktiv oppgjørsavtale",
  notActivated: {
    title: "Oppgjør er ikke aktivert",
    text: "Oppgjør er ikke aktivert for denne leverandøren ennå. Kontakt Lunchportalen for å aktivere oppgjørsavtale og fakturagrunnlag.",
  },
  // Produktcopy for den kommersielle modellen — ikke en beregningsverdi.
  commissionNote: "Lunchportalen beregner 5 % provisjon per solgte porsjon når oppgjør er aktivert.",
  summary: {
    settlementStatus: "Oppgjørsstatus",
    commission: "Provisjon",
    nextSettlement: "Neste oppgjør",
  },
  history: {
    title: "Fakturagrunnlag og oppgjør",
    emptyTitle: "Ingen fakturagrunnlag er generert ennå",
    emptyText:
      "Når oppgjør er aktivert og grunnlaget er klart, vises fakturagrunnlag, provisjon, beløp, status og forfall her.",
  },
  tableHeaders: {
    period: "Periode",
    amount: "Beløp",
    status: "Status",
    dueDate: "Forfall",
  },
} as const;

/** Provider-safe oppgjørsstatus — basert på om aktiv oppgjørsavtale finnes i data. */
export function settlementStatusLabel(hasActiveSubscription: boolean): string {
  return hasActiveSubscription ? "Aktiv" : "Ikke aktivert";
}

/** Provider-safe fakturastatus — aldri rå enum i UI. */
export function invoiceStatusLabel(status: unknown): string {
  const s = String(status ?? "").trim().toUpperCase();
  return INVOICE_STATUS_LABELS[s] ?? "Ukjent";
}

export type BillingSummaryCard = {
  id: "settlementStatus" | "commission" | "nextSettlement";
  label: string;
  value: string;
  hint: string | null;
};

/**
 * Rolige summary cards fra eksisterende read-data — ingen nye queries, ingen fake tall.
 * Provisjonssats og neste oppgjør finnes ikke i read model ennå og vises derfor
 * med kontrollerte, ærlige verdier.
 */
export function buildBillingSummaryCards(input: { hasActiveSubscription: boolean }): BillingSummaryCard[] {
  const active = input.hasActiveSubscription === true;
  return [
    {
      id: "settlementStatus",
      label: PROVIDER_BILLING_COPY.summary.settlementStatus,
      value: settlementStatusLabel(active),
      hint: active ? null : "Kontakt Lunchportalen for å aktivere.",
    },
    {
      id: "commission",
      label: PROVIDER_BILLING_COPY.summary.commission,
      value: "Vises når oppgjør er aktivert",
      hint: null,
    },
    {
      id: "nextSettlement",
      label: PROVIDER_BILLING_COPY.summary.nextSettlement,
      value: "Ikke planlagt",
      hint: null,
    },
  ];
}
