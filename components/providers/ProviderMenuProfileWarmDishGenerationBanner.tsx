"use client";

import { useTranslations } from "next-intl";

import type { ProviderMenuWarmDishGenerationPresentation } from "@/lib/provider-menu/providerMenuProfileWarmDishGeneration";

type Props = {
  presentation: Extract<ProviderMenuWarmDishGenerationPresentation, { active: true }>;
  onGenerateWeek?: () => void;
  generating?: boolean;
  canGenerate?: boolean;
};

export default function ProviderMenuProfileWarmDishGenerationBanner({
  presentation,
  onGenerateWeek,
  generating = false,
  canGenerate = false,
}: Props) {
  const t = useTranslations("provider.menu.workspaceWarmDishGeneration");

  return (
    <section
      className="lp-editor-profile-warm-dish-generation"
      data-testid="provider-menu-profile-warm-dish-generation-banner"
      aria-labelledby="lp-editor-profile-warm-dish-generation-title"
    >
      <header className="lp-editor-profile-warm-dish-generation__head">
        <h3 id="lp-editor-profile-warm-dish-generation-title" className="lp-editor-profile-warm-dish-generation__title">
          {t("title")}
        </h3>
        <p className="lp-editor-profile-warm-dish-generation__description">{t("description")}</p>
        <p className="lp-editor-profile-warm-dish-generation__meta">
          {t("profileMeta", {
            profileId: presentation.profileId,
            profileName: presentation.profileName,
            market: presentation.market,
            locale: presentation.locale,
            seedCount: presentation.seedCount,
          })}
        </p>
      </header>

      {canGenerate && onGenerateWeek ? (
        <div className="lp-editor-profile-warm-dish-generation__actions">
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={onGenerateWeek}
            disabled={generating}
            data-testid="provider-menu-generate-profile-week"
          >
            {generating ? t("generating") : t("generateWeek")}
          </button>
          <p className="lp-editor-profile-warm-dish-generation__hint">{t("generateHint")}</p>
        </div>
      ) : null}
    </section>
  );
}
