"use client";

import type { WeekWorkspaceMetrics } from "@/lib/provider-menu/providerMenuWorkspace";
import { formatPriceExVatLabel } from "@/lib/providers/providerMenuPriceDisplay";

type Props = {
  weekStart: string;
  tierLabel: string;
  metrics: WeekWorkspaceMetrics;
  priceExVatNok: number | null;
};

export default function ProviderMenuStatusRow({ weekStart, tierLabel, metrics, priceExVatNok }: Props) {
  return (
    <section className="menu-workspace-status" aria-label="Ukestatus">
      <div className="menu-workspace-status__primary">
        <span className="menu-workspace-status__week">Uke fra {weekStart}</span>
        <span className="menu-workspace-status__tier">{tierLabel}</span>
        {priceExVatNok != null ? (
          <span className="menu-workspace-status__price">{formatPriceExVatLabel(priceExVatNok)} eks. mva</span>
        ) : null}
      </div>
      <div className="menu-workspace-status__metrics">
        <span className="menu-workspace-status__metric">
          <strong>{metrics.daysPlanned}</strong> dager
        </span>
        <span className="menu-workspace-status__metric">
          <strong>{metrics.varmrettFilled}</strong> varmrett
        </span>
        <span className="menu-workspace-status__metric is-published">
          <strong>{metrics.publishedSlots}</strong> publisert
        </span>
        <span className="menu-workspace-status__metric is-draft">
          <strong>{metrics.draftSlots}</strong> utkast
        </span>
        <span className="menu-workspace-status__metric is-missing">
          <strong>{metrics.varmrettMissing}</strong> mangler varmrett
        </span>
      </div>
    </section>
  );
}
