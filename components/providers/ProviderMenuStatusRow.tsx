"use client";

import type { WeekWorkspaceMetrics } from "@/lib/provider-menu/providerMenuWorkspace";

type Props = {
  weekStart: string;
  tierLabel: string;
  metrics: WeekWorkspaceMetrics;
  varmrettPublishedDays: number;
  varmrettDraftDays: number;
  priceExVatNok: number | null;
  nextStep: string;
};

export default function ProviderMenuStatusRow({
  metrics,
  varmrettPublishedDays,
}: Props) {
  const daysTotal = metrics.daysPlanned;
  const allReady = metrics.varmrettMissing === 0 && daysTotal > 0;
  const allGenerated = allReady && metrics.varmrettFilled === daysTotal;

  const headline = allGenerated
    ? `Uka er klar — varmrett generert for alle ${daysTotal} dager`
    : metrics.varmrettMissing > 0
      ? `${metrics.varmrettMissing} ${metrics.varmrettMissing === 1 ? "dag mangler" : "dager mangler"} varmrett`
      : `${metrics.varmrettFilled} av ${daysTotal} dager med varmrett`;

  const meta = allGenerated
    ? "Publiseres automatisk torsdag 08:00 · ansatte ser uka kl. 14:00"
    : "Fyll inn manglende varmretter før uken kan publiseres";

  return (
    <section className="lp-editor-status-strip" aria-label="Ukestatus">
      <div className="lp-editor-status-strip__ok">
        <span className="lp-editor-status-strip__ring" aria-hidden="true">
          ✓
        </span>
        <div>
          <b>{headline}</b>
          <div className="lp-editor-status-strip__meta">{meta}</div>
        </div>
      </div>
      {allReady ? (
        <span className="lp-editor-status-strip__chip">
          <span aria-hidden="true">⚡</span>
          Auto-rollout aktiv
        </span>
      ) : null}
      {varmrettPublishedDays > 0 ? (
        <span className="lp-editor-status-strip__published" role="status">
          {varmrettPublishedDays} dag(er) publisert
        </span>
      ) : null}
    </section>
  );
}
