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
  const daysReady = metrics.varmrettFilled;
  const daysTotal = metrics.daysPlanned;
  const allReady = metrics.varmrettMissing === 0 && daysTotal > 0;

  return (
    <section className="lp-editor-status-strip" aria-label="Ukestatus">
      <div className="lp-editor-status-strip__ok">
        <span className="lp-editor-status-strip__ring" aria-hidden="true">✓</span>
        <div>
          <b>
            {allReady
              ? `${daysReady} av ${daysTotal} dager klare`
              : `${daysReady} av ${daysTotal} dager med varmrett`}
          </b>
          <div className="lp-editor-status-strip__meta">
            Publiseres automatisk torsdag 08:00 · ansatte ser uka kl. 14:00
          </div>
        </div>
      </div>
      <span className="lp-editor-status-strip__chip">
        <span aria-hidden="true">⚡</span>
        Auto-rollout aktiv
      </span>
      {varmrettPublishedDays > 0 ? (
        <span className="lp-editor-status-strip__published" role="status">
          {varmrettPublishedDays} dag(er) publisert
        </span>
      ) : null}
    </section>
  );
}
