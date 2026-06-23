"use client";

import { useTranslations } from "next-intl";

import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  counts: DashboardData["resourceCounts"];
};

const CARD_KEYS = [
  { key: "products" as const, labelKey: "products", metaKey: "productsMeta" },
  { key: "customers" as const, labelKey: "customers", metaKey: "customersMeta" },
  { key: "vatCodes" as const, labelKey: "vatCodes", metaKey: "vatCodesMeta" },
];

export default function ResourceSummary({ counts }: Props) {
  const t = useTranslations("provider.tripletex.status.cards");

  return (
    <div className="ds-cards-3 ds-tripletex-status__resource-grid">
      {CARD_KEYS.map((card) => (
        <article key={card.key} className="ds-card ds-tripletex-status__resource-card">
          <p className="ds-eyebrow">{t(card.labelKey)}</p>
          <p className="ds-tripletex-status__stat-number">{counts[card.key]}</p>
          <p className="ds-body-sm ds-tripletex-status__text-soft">{t(card.metaKey)}</p>
        </article>
      ))}
    </div>
  );
}
