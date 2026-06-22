"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("provider.menu.status");
  const daysTotal = metrics.daysPlanned;
  const allReady = metrics.varmrettMissing === 0 && daysTotal > 0;
  const allGenerated = allReady && metrics.varmrettFilled === daysTotal;

  const headline = allGenerated
    ? t("readyAllGenerated", { days: daysTotal })
    : metrics.varmrettMissing > 0
      ? t("daysMissingVarmrett", { count: metrics.varmrettMissing })
      : t("daysWithVarmrett", { filled: metrics.varmrettFilled, total: daysTotal });

  const meta = allGenerated ? t("autoRolloutMeta") : t("fillMissingMeta");

  return (
    <section className="lp-editor-status-strip" aria-label={t("ariaLabel")}>
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
          {t("autoRolloutChip")}
        </span>
      ) : null}
      {varmrettPublishedDays > 0 ? (
        <span className="lp-editor-status-strip__published" role="status">
          {t("daysPublished", { count: varmrettPublishedDays })}
        </span>
      ) : null}
    </section>
  );
}
