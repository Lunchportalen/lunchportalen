"use client";

import type { WeekWorkspaceMetrics } from "@/lib/provider-menu/providerMenuWorkspace";
import { formatPriceExVatLabel } from "@/lib/providers/providerMenuPriceDisplay";

type Props = {
  weekStart: string;
  tierLabel: string;
  metrics: WeekWorkspaceMetrics;
  varmrettPublishedDays: number;
  varmrettDraftDays: number;
  priceExVatNok: number | null;
  nextStep: string;
};

function buildCockpitDisplaySummary(
  weekStart: string,
  metrics: WeekWorkspaceMetrics,
  varmrettPublishedDays: number,
  varmrettDraftDays: number,
): string {
  const parts = [
    `Uke fra ${weekStart}`,
    `${metrics.daysPlanned} dager`,
    metrics.varmrettMissing > 0
      ? `${metrics.varmrettMissing} varmretter mangler`
      : `${metrics.varmrettFilled} varmrett satt`,
  ];

  if (varmrettPublishedDays > 0) {
    parts.push(`${varmrettPublishedDays} varmrett publisert`);
  }
  if (varmrettDraftDays > 0) {
    parts.push(`${varmrettDraftDays} varmrett utkast`);
  }

  if (metrics.varmrettMissing > 0) {
    parts.push("Ikke klar for publisering");
  } else if (varmrettPublishedDays === metrics.daysPlanned) {
    parts.push("Varmrett klar for bestilling");
  } else if (varmrettDraftDays > 0) {
    parts.push("Har varmrett-utkast");
  } else {
    parts.push("Klar for publisering");
  }

  return parts.join(" · ");
}

function cockpitStatusLabel(
  metrics: WeekWorkspaceMetrics,
  varmrettPublishedDays: number,
  varmrettDraftDays: number,
): string {
  if (metrics.varmrettMissing > 0) return "Mangler varmrett";
  if (varmrettPublishedDays === metrics.daysPlanned) return "Varmrett publisert";
  if (varmrettDraftDays > 0) return "Har varmrett-utkast";
  return "Klar for publisering";
}

function cockpitStatusClass(
  metrics: WeekWorkspaceMetrics,
  varmrettPublishedDays: number,
  varmrettDraftDays: number,
): string {
  if (metrics.varmrettMissing > 0) return "is-missing";
  if (varmrettPublishedDays === metrics.daysPlanned) return "is-published";
  if (varmrettDraftDays > 0) return "is-draft";
  return "is-neutral";
}

export default function ProviderMenuStatusRow({
  weekStart,
  tierLabel,
  metrics,
  varmrettPublishedDays,
  varmrettDraftDays,
  priceExVatNok,
  nextStep,
}: Props) {
  const cockpitLine = buildCockpitDisplaySummary(
    weekStart,
    metrics,
    varmrettPublishedDays,
    varmrettDraftDays,
  );
  const displayStatus = cockpitStatusLabel(metrics, varmrettPublishedDays, varmrettDraftDays);
  const displayStatusClass = cockpitStatusClass(metrics, varmrettPublishedDays, varmrettDraftDays);
  const varmrettProgress =
    metrics.daysPlanned > 0 ? Math.round((metrics.varmrettFilled / metrics.daysPlanned) * 100) : 0;
  const varmrettWarning =
    metrics.varmrettMissing > 0
      ? `${metrics.varmrettMissing} ${metrics.varmrettMissing === 1 ? "dag mangler" : "dager mangler"} varmrett`
      : null;

  return (
    <section className="lp-editor-cockpit" aria-label="Uke-cockpit">
      <div className="lp-editor-cockpit__grid">
        <div className="lp-editor-cockpit__main">
          <p className="lp-editor-cockpit__eyebrow">Operativ ukestatus</p>
          <p className="lp-editor-cockpit__summary">{cockpitLine}</p>
          <div className="lp-editor-cockpit__meta">
            <span className="lp-editor-cockpit__tier">{tierLabel}</span>
            {priceExVatNok != null ? (
              <span className="lp-editor-cockpit__price">{formatPriceExVatLabel(priceExVatNok)}</span>
            ) : null}
            <span className={`lp-editor-cockpit__status ${displayStatusClass}`} role="status">
              {displayStatus}
            </span>
          </div>
        </div>

        <div className="lp-editor-cockpit__metrics" aria-label="Ukeprogresjon">
          <div className="lp-editor-cockpit__metric">
            <span className="lp-editor-cockpit__metric-value">
              {metrics.varmrettFilled}/{metrics.daysPlanned}
            </span>
            <span className="lp-editor-cockpit__metric-label">Varmrett satt</span>
          </div>
          <div className="lp-editor-cockpit__metric">
            <span className="lp-editor-cockpit__metric-value">{varmrettPublishedDays}</span>
            <span className="lp-editor-cockpit__metric-label">Varmrett publisert</span>
          </div>
          <div className="lp-editor-cockpit__metric">
            <span className="lp-editor-cockpit__metric-value">{varmrettDraftDays}</span>
            <span className="lp-editor-cockpit__metric-label">Varmrett utkast</span>
          </div>
        </div>

        <div className="lp-editor-cockpit__action">
          <span className="lp-editor-cockpit__next-label">Neste steg</span>
          <span className="lp-editor-cockpit__next-step">{nextStep}</span>
        </div>
      </div>

      <div className="lp-editor-cockpit__progress" aria-hidden="true">
        <div className="lp-editor-cockpit__progress-track">
          <div
            className={`lp-editor-cockpit__progress-fill${varmrettProgress >= 100 ? " is-complete" : ""}`}
            style={{ width: `${varmrettProgress}%` }}
          />
        </div>
        <span className="lp-editor-cockpit__progress-label">{varmrettProgress}% varmrett klar</span>
      </div>

      {varmrettWarning ? (
        <p className="lp-editor-cockpit__warning" role="status">
          {varmrettWarning}. Uken kan ikke publiseres før alle leveringsdager har dagens varmrett.
        </p>
      ) : null}
    </section>
  );
}
